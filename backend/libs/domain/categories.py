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
        "supplement",
        "nutrition",
        "피트니스",
        "운동",
        "헬스",
        "건강",
        "건강기능식품",
        "영양제",
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
        "menswear",
        "men's clothing",
        "sleeveless",
        "tank top",
        "패션",
        "스타일",
        "의류",
        "남성복",
        "남성 의류",
        "남성 슬리브리스",
        "맨즈 슬리브리스",
        "슬리브리스",
        "상의",
        "민소매",
        "나시",
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
    exact = _LOOKUP.get(normalized)
    if exact:
        return exact
    for alias, category in sorted(_LOOKUP.items(), key=lambda item: len(item[0]), reverse=True):
        if len(alias) >= 2 and alias in normalized:
            return category
    return normalized


def category_set(values: Iterable[str]) -> set[str]:
    return {canonical_category(value) for value in values if value.strip()}


def category_matches(required: Iterable[str], available: Iterable[str]) -> bool:
    required_set = category_set(required)
    if not required_set:
        return True
    return bool(required_set.intersection(category_set(available)))
