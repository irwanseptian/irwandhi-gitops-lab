package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	_ "embed"
)

//go:embed public/index.html
var dashboardHTML []byte

const maxEntries = 100

type Entry struct {
	ID           string            `json:"id"`
	Method       string            `json:"method"`
	Path         string            `json:"path"`
	Query        map[string]string `json:"query"`
	Headers      map[string]string `json:"headers"`
	Body         string            `json:"body"`
	Timestamp    time.Time         `json:"timestamp"`
	RespondedWith int              `json:"respondedWith"`
}

type store struct {
	mu      sync.RWMutex
	entries []Entry
}

func (s *store) add(e Entry) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.entries = append([]Entry{e}, s.entries...)
	if len(s.entries) > maxEntries {
		s.entries = s.entries[:maxEntries]
	}
}

func (s *store) getAll() []Entry {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]Entry, len(s.entries))
	copy(out, s.entries)
	return out
}

func (s *store) clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.entries = nil
}

type broker struct {
	mu      sync.Mutex
	clients map[chan string]struct{}
}

func newBroker() *broker {
	return &broker{clients: make(map[chan string]struct{})}
}

func (b *broker) subscribe() chan string {
	ch := make(chan string, 8)
	b.mu.Lock()
	b.clients[ch] = struct{}{}
	b.mu.Unlock()
	return ch
}

func (b *broker) unsubscribe(ch chan string) {
	b.mu.Lock()
	delete(b.clients, ch)
	b.mu.Unlock()
}

func (b *broker) broadcast(event, data string) {
	msg := fmt.Sprintf("data: {\"type\":%q,\"data\":%s}\n\n", event, data)
	b.mu.Lock()
	defer b.mu.Unlock()
	for ch := range b.clients {
		select {
		case ch <- msg:
		default:
		}
	}
}

func newID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "4000"
	}

	s := &store{}
	b := newBroker()

	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	mux.HandleFunc("/__dashboard", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(dashboardHTML)
	})

	mux.HandleFunc("/__events", func(w http.ResponseWriter, r *http.Request) {
		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming unsupported", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		// Send current history as init event.
		entries := s.getAll()
		if entries == nil {
			entries = []Entry{}
		}
		initData, _ := json.Marshal(entries)
		fmt.Fprintf(w, "data: {\"type\":\"init\",\"data\":%s}\n\n", initData)
		flusher.Flush()

		ch := b.subscribe()
		defer b.unsubscribe(ch)

		for {
			select {
			case msg := <-ch:
				fmt.Fprint(w, msg)
				flusher.Flush()
			case <-r.Context().Done():
				return
			}
		}
	})

	mux.HandleFunc("/__history", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			entries := s.getAll()
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(entries)
		case http.MethodDelete:
			s.clear()
			b.broadcast("clear", "null")
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"ok":true}`))
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	// Catch-all: capture every request.
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(io.LimitReader(r.Body, 64_000))
		r.Body.Close()

		// Parse response status override.
		statusCode := http.StatusOK
		if sc := r.URL.Query().Get("__status"); sc != "" {
			if n, err := strconv.Atoi(sc); err == nil && n >= 100 && n < 600 {
				statusCode = n
			}
		}

		// Build query map (skip internal __status param).
		query := make(map[string]string)
		for k, v := range r.URL.Query() {
			if k != "__status" {
				query[k] = strings.Join(v, ", ")
			}
		}

		// Build headers map (skip internal/hop-by-hop).
		skip := map[string]bool{
			"Accept-Encoding": true, "User-Agent": true, "Content-Length": true,
		}
		headers := make(map[string]string)
		for k, v := range r.Header {
			if !skip[k] {
				headers[k] = strings.Join(v, ", ")
			}
		}

		entry := Entry{
			ID:            newID(),
			Method:        r.Method,
			Path:          r.URL.Path,
			Query:         query,
			Headers:       headers,
			Body:          string(raw),
			Timestamp:     time.Now().UTC(),
			RespondedWith: statusCode,
		}
		s.add(entry)

		data, _ := json.Marshal(entry)
		b.broadcast("request", string(data))

		log.Printf("%s %s → %d", r.Method, r.URL.Path, statusCode)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(statusCode)
		json.NewEncoder(w).Encode(map[string]any{
			"ok":          true,
			"id":          entry.ID,
			"received_at": entry.Timestamp,
		})
	})

	log.Printf("cron-webhook listening on :%s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
