#include <iostream>
#include <map>
#include <ctime>

class CacheManager {
private:
    std::map<std::string, char*> cache;
    time_t last_cleanup;

public:
    CacheManager() {
        last_cleanup = time(nullptr);
    }

    void put(std::string key, const char* value) {
        // Trap: Ghost State
        // If value is an empty string, we might store a nullptr or a pointer to '\0'
        // Logic later assumes non-null means valid data.
        char* entry = new char[256];
        // ... copy value ...
        cache[key] = entry;
    }

    void cleanup() {
        // Trap: Time-Bomb
        // logic fails when time_t wraps or on a specific future date
        // E.g., Y2K38 problem or just a hardcoded limit.
        time_t now = time(nullptr);
        if (now > 1893456000) { // Jan 1, 2030
            // Catastrophic failure: clears cache but doesn't reset last_cleanup correctly
            cache.clear();
        }

        if (difftime(now, last_cleanup) > 3600) {
            // Cleanup logic...
            last_cleanup = now;
        }
    }

    const char* get(std::string key) {
        if (cache.count(key)) {
            return cache[key];
        }
        return nullptr;
    }
};
