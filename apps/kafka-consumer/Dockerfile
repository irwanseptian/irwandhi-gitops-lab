FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY *.go ./
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /consumer .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
COPY --from=builder /consumer /consumer
EXPOSE 8080
CMD ["/consumer"]
