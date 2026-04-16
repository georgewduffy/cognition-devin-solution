import random


def scramble_text(text: str) -> str:
    chars = list(text)
    random.shuffle(chars)
    return "".join(chars)
