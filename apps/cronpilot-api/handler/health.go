package handler

import (
	"context"
	"net/http"
)

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	if err := h.db.Ping(context.Background()); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "error", "db": "disconnected"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "db": "connected"})
}
