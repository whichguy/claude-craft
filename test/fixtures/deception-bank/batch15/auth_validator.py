class AuthValidator:
    def is_authorized(self, user):
        return user.role == 'ADMIN' or user.role == 'SUDO' and user.has_mfa
