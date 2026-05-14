package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"sync/atomic"
	"time"

	"github.com/IBM/sarama"
)

type Order struct {
	ID        string    `json:"id"`
	Product   string    `json:"product"`
	Amount    float64   `json:"amount"`
	CreatedAt time.Time `json:"created_at"`
}

var (
	produced atomic.Int64
	products = []string{"widget", "gadget", "doohickey", "thingamajig", "whatchamacallit"}
)

func newOrder() Order {
	return Order{
		ID:        fmt.Sprintf("ord-%d-%d", time.Now().UnixNano(), rand.Intn(10000)),
		Product:   products[rand.Intn(len(products))],
		Amount:    float64(rand.Intn(10000)) / 100.0,
		CreatedAt: time.Now().UTC(),
	}
}

func newProducer(brokers []string) (sarama.SyncProducer, error) {
	cfg := sarama.NewConfig()
	cfg.Producer.RequiredAcks = sarama.WaitForLocal
	cfg.Producer.Return.Successes = true
	cfg.Producer.Retry.Max = 5
	cfg.Net.DialTimeout = 30 * time.Second

	for i := 1; i <= 30; i++ {
		p, err := sarama.NewSyncProducer(brokers, cfg)
		if err == nil {
			return p, nil
		}
		log.Printf("kafka not ready, retry %d/30: %v", i, err)
		time.Sleep(5 * time.Second)
	}
	return nil, fmt.Errorf("kafka unreachable after 30 retries")
}

func send(p sarama.SyncProducer, topic string, n int) {
	for i := 0; i < n; i++ {
		b, _ := json.Marshal(newOrder())
		msg := &sarama.ProducerMessage{Topic: topic, Value: sarama.ByteEncoder(b)}
		if _, _, err := p.SendMessage(msg); err != nil {
			log.Printf("send error: %v", err)
			continue
		}
		total := produced.Add(1)
		if total%1000 == 0 {
			log.Printf("produced %d messages total", total)
		}
	}
}

func main() {
	brokers := []string{envOr("KAFKA_BROKERS", "kafka.kafka.svc.cluster.local:9092")}
	topic := envOr("KAFKA_TOPIC", "orders")
	rate := envInt("PRODUCE_RATE", 50) // msg/s

	p, err := newProducer(brokers)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()
	log.Printf("connected to %v, topic=%s rate=%d/s", brokers, topic, rate)

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok","produced":%d}`, produced.Load())
	})
	mux.HandleFunc("/burst", func(w http.ResponseWriter, r *http.Request) {
		n := 50000
		if s := r.URL.Query().Get("n"); s != "" {
			if v, err := strconv.Atoi(s); err == nil && v > 0 {
				n = v
			}
		}
		log.Printf("burst: firing %d messages", n)
		go send(p, topic, n)
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"ok":true,"sending":%d}`, n)
	})

	go func() {
		log.Println("http server on :8080")
		if err := http.ListenAndServe(":8080", mux); err != nil {
			log.Fatal(err)
		}
	}()

	// Continuous rate-limited production.
	interval := time.Second / time.Duration(rate)
	ctx := context.Background()
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			go func() { send(p, topic, 1) }()
		case <-ctx.Done():
			return
		}
	}
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return def
}
