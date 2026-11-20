BEGIN;
CREATE TABLE IF NOT EXISTS pdv_companies(id TEXT PRIMARY KEY,name TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS pdv_branches(company_id TEXT NOT NULL REFERENCES pdv_companies(id),id TEXT NOT NULL,name TEXT NOT NULL,active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),PRIMARY KEY(company_id,id));
CREATE TABLE IF NOT EXISTS pdv_terminal_tokens(token_hash CHAR(64) PRIMARY KEY,company_id TEXT NOT NULL,branch_id TEXT NOT NULL,terminal_id TEXT NOT NULL,active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),FOREIGN KEY(company_id,branch_id) REFERENCES pdv_branches(company_id,id));
CREATE TABLE IF NOT EXISTS pdv_sync_events(sequence BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,company_id TEXT NOT NULL,branch_id TEXT NOT NULL,event_id VARCHAR(160) NOT NULL,terminal_id VARCHAR(160) NOT NULL,kind TEXT NOT NULL,entity_id VARCHAR(160) NOT NULL,payload JSONB NOT NULL,payload_hash CHAR(64) NOT NULL,received_at TIMESTAMPTZ NOT NULL DEFAULT now(),FOREIGN KEY(company_id,branch_id) REFERENCES pdv_branches(company_id,id),UNIQUE(company_id,branch_id,event_id));
CREATE INDEX IF NOT EXISTS idx_pdv_sync_cursor ON pdv_sync_events(company_id,branch_id,sequence);
COMMIT;
