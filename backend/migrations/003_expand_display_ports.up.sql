BEGIN;
ALTER TABLE display_ports DROP CONSTRAINT IF EXISTS display_ports_port_number_check;
ALTER TABLE display_ports ADD CONSTRAINT display_ports_port_number_check
    CHECK (port_number BETWEEN 8080 AND 8095);
UPDATE display_ports SET label = 'Display8080' WHERE port_number = 8080 AND label = 'Default Display';
COMMIT;
