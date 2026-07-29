from collections.abc import Iterable

_ALIASES = {
    "beauty": {
        "beauty",
        "cosmetic",
        "cosmetics",
        "skincare",
        "skin care",
        "wellness beauty",
        "뷰티",
        "화장품",
        "코스메틱",
        "스킨케어",
        "피부관리",
    },
    "fitness": {
        "fitness",
        "health",
        "wellness",
        "workout",
        "exercise",
        "피트니스",
        "운동",
        "헬스",
        "건강",
        "웰니스",
    },
    "lifestyle": {
        "lifestyle",
        "daily",
        "life",
        "home",
        "라이프스타일",
        "일상",
        "생활",
        "홈",
    },
    "fashion": {
        "fashion",
        "style",
        "apparel",
        "clothing",
        "패션",
        "스타일",
        "의류",
    },
    "food": {
        "food",
        "beverage",
        "drink",
        "cafe",
        "restaurant",
        "푸드",
        "음식",
        "식품",
        "음료",
        "카페",
        "맛집",
    },
    "tobacco": {
        "tobacco",
        "cigarette",
        "smoking",
        "vape",
        "담배",
        "흡연",
        "전자담배",
    },
    "alcohol": {
        "alcohol",
        "beer",
        "wine",
        "liquor",
        "술",
        "주류",
        "맥주",
        "와인",
    },
    "gambling": {
        "gambling",
        "casino",
        "betting",
        "도박",
        "카지노",
        "베팅",
    },
}

_LOOKUP = {alias: category for category, aliases in _ALIASES.items() for alias in aliases}


def canonical_category(value: str) -> str:
    normalized = " ".join(value.casefold().strip().replace("_", " ").replace("-", " ").split())
    return _LOOKUP.get(normalized, normalized)


def category_set(values: Iterable[str]) -> set[str]:
    return {canonical_category(value) for value in values if value.strip()}


def category_matches(required: Iterable[str], available: Iterable[str]) -> bool:
    required_set = category_set(required)
    if not required_set:
        return True
    return bool(required_set.intersection(category_set(available)))
