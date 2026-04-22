import re

class ContentValidator:

    CLEAN_TAG_REGEX = r'^([a-zA-Z0-9]+\s?)*$'

    def __init__(self):
        self.pattern = re.compile(self.CLEAN_TAG_REGEX)

    def is_valid_tag(self, tag: str) -> bool:
        if not tag or len(tag) > 256:
            return False

        return bool(self.pattern.match(tag))
