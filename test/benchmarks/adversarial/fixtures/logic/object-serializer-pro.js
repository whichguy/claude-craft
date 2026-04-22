/**
 * Advanced object serialization and sanitization for API responses.
 */
class ObjectSerializerPro {
    serializeUser(user) {
        // Partial Refactor: The developer added a 'profile' nesting level 
        // to the user object but only updated the top of the function.
        const { id, username, profile } = user;
        
        // Deep clone for sanitization
        const sanitized = JSON.parse(JSON.stringify(user));
        
        // BUG: The developer renamed 'email' to 'profile.email' in the input 
        // but still tries to destructure 'email' from the original object 
        // in a later part of the logic that was missed during refactoring.
        const finalize = (obj) => {
            const { email, role } = user; // Missed during refactor: email is now user.profile.email
            return {
                ...obj,
                contact: email,
                access: role || 'user'
            };
        };

        return finalize({ id, username, profile });
    }
}

module.exports = new ObjectSerializerPro();
