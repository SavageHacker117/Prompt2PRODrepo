# lightweight Python service that could mirror agentic-planner.ts
def choose_best_server(intent, registry):
    if not registry:
        return None
    # naive: first match
    for srv in registry:
        if intent in srv.get("tags", []):
            return srv
    return registry[0]
