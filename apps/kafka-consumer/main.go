package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
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

var consumed atomic.Int64

type handler struct {
	processDelay time.Duration
}

func (h *handler) Setup(_ sarama.ConsumerGroupSession) error   { return nil }
func (h *handler) Cleanup(_ sarama.ConsumerGroupSession) error { return nil }
func (h *handler) ConsumeClaim(session sarama.ConsumerGroupSession, claim sarama.ConsumerGroupClaim) error {
	for msg := range claim.Messages() {
		var order Order
		if err := json.Unmarshal(msg.Value, &order); err == nil {
			log.Printf("processing order=%s product=%s amount=%.2f lag=%d",
				order.ID, order.Product, order.Amount,
				claim.HighWaterMarkOffset()-msg.Offset-1)
		}
		// Intentionally slow — drives lag that triggers KEDA scale-out.
		time.Sleep(h.processDelay)
		session.MarkMessage(msg, "")
		if n := consumed.Add(1); n%100 == 0 {
			log.Printf("consumed %d messages total", n)
		}
	}
	return nil
}

func newConsumerGroup(brokers []string, group string) (sarama.ConsumerGroup, error) {
	cfg := sarama.NewConfig()
	cfg.Consumer.Group.Rebalance.GroupStrategies = []sarama.BalanceStrategy{
		sarama.NewBalanceStrategyRoundRobin(),
	}
	cfg.Consumer.Offsets.Initial = sarama.OffsetNewest
	cfg.Consumer.Offsets.AutoCommit.Enable = true
	cfg.Consumer.Offsets.AutoCommit.Interval = 5 * time.Second
	cfg.Net.DialTimeout = 30 * time.Second

	for i := 1; i <= 30; i++ {
		cg, err := sarama.NewConsumerGroup(brokers, group, cfg)
		if err == nil {
			return cg, nil
		}
		log.Printf("kafka not ready, retry %d/30: %v", i, err)
		time.Sleep(5 * time.Second)
	}
	return nil, fmt.Errorf("kafka unreachable after 30 retries")
}

func main() {
	brokers := []string{envOr("KAFKA_BROKERS", "kafka.kafka.svc.cluster.local:9092")}
	topic := envOr("KAFKA_TOPIC", "orders")
	group := envOr("KAFKA_CONSUMER_GROUP", "order-processor")
	delayMs := envInt("PROCESS_DELAY_MS", 200) // 200ms → max 5 msg/s per pod

	cg, err := newConsumerGroup(brokers, group)
	if err != nil {
		log.Fatal(err)
	}
	defer cg.Close()
	log.Printf("connected to %v, topic=%s group=%s delay=%dms", brokers, topic, group, delayMs)

	go func() {
		mux := http.NewServeMux()
		mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprintf(w, `{"status":"ok","consumed":%d}`, consumed.Load())
		})
		log.Println("http server on :8080")
		if err := http.ListenAndServe(":8080", mux); err != nil {
			log.Fatal(err)
		}
	}()

	h := &handler{processDelay: time.Duration(delayMs) * time.Millisecond}
	ctx := context.Background()
	for {
		if err := cg.Consume(ctx, []string{topic}, h); err != nil {
			log.Printf("consume error: %v", err)
			time.Sleep(time.Second)
		}
		if ctx.Err() != nil {
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
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			return n
		}
	}
	return def
}
