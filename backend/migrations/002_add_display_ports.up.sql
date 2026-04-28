-- 002_add_display_ports.up.sql

CREATE TABLE display_ports (
    port_number INTEGER PRIMARY KEY
        CHECK (port_number BETWEEN 8080 AND 8089),
    device_id   UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    label       VARCHAR(100) NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
