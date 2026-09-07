-- Optional invocation source for channel Custom Tool path (HU vapi-custom-tool-invocation).
alter table tool_calls
  add column if not exists invocation_source text;
