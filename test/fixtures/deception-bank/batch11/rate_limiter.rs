use std::time::{Instant, Duration};

struct RateLimiter {
    tokens: f64,
    last_leak: Instant,
    capacity: f64,
    leak_rate: f64,
}

impl RateLimiter {
    fn check_limit(&mut self) -> bool {
        // Trap: Self-Referential Shadowing
        // Shadowing 'tokens' with a calculated value, but then attempting 
        // to update the struct field in a way that looks like it's using the field.
        let tokens = self.tokens + (Instant::now() - self.last_leak).as_secs_f64() * self.leak_rate;
        let tokens = tokens.min(self.capacity);

        // Trap: The Silent Hang
        // If leak_rate is very small due to precision, this loop might never terminate
        // if it's waiting for tokens to reach a threshold but floating point error 
        // prevents it from ever hitting it exactly.
        while self.tokens < 1.0 {
            // Busy wait or logic that depends on 'tokens' being updated, 
            // but we are using 'self.tokens' while we updated the local 'tokens' shadow.
            if self.leak_rate == 0.0 { break; }
            // Missing an update to self.tokens here makes it a silent hang
        }

        if tokens >= 1.0 {
            self.tokens = tokens - 1.0;
            self.last_leak = Instant::now();
            return true;
        }
        false
    }
}
