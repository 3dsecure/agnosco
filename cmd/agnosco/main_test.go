package main

import (
	"testing"
	"time"
)

func TestEnrichAReqBrowserAddsBrowserFields(t *testing.T) {
	m := map[string]interface{}{"deviceChannel": "02"}
	now := time.Date(2026, 6, 29, 12, 0, 0, 0, time.UTC)

	enrichAReq(m, "02", "203.0.113.7", "text/html", []string{"en-US", "en"}, now)

	if m["browserIP"] != "203.0.113.7" {
		t.Errorf("browserIP = %v, want 203.0.113.7", m["browserIP"])
	}
	if m["browserAcceptHeader"] != "text/html" {
		t.Errorf("browserAcceptHeader = %v, want text/html", m["browserAcceptHeader"])
	}
	if got, ok := m["acceptLanguage"].([]string); !ok || len(got) != 2 {
		t.Errorf("acceptLanguage = %v, want [en-US en]", m["acceptLanguage"])
	}
	if m["purchaseDate"] != "20260629120000" {
		t.Errorf("purchaseDate = %v, want 20260629120000", m["purchaseDate"])
	}
}

func TestEnrichAReq3RIOmitsBrowserFields(t *testing.T) {
	m := map[string]interface{}{"deviceChannel": "03"}
	now := time.Date(2026, 6, 29, 12, 0, 0, 0, time.UTC)

	enrichAReq(m, "03", "203.0.113.7", "text/html", []string{"en-US"}, now)

	for _, k := range []string{"browserIP", "browserAcceptHeader", "acceptLanguage"} {
		if _, present := m[k]; present {
			t.Errorf("3RI request must not contain %q, got %v", k, m[k])
		}
	}
	if m["purchaseDate"] != "20260629120000" {
		t.Errorf("purchaseDate = %v, want 20260629120000", m["purchaseDate"])
	}
}
