CREATE TABLE IF NOT EXISTS telemetry_events
(
    ts DateTime DEFAULT now(),
    type String,
    payload String
)
ENGINE = MergeTree()
ORDER BY ts;
