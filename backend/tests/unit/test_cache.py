from app.core.cache import ttl_with_jitter


def test_ttl_with_jitter_stays_within_expected_window() -> None:
    base_ttl = 300

    values = {ttl_with_jitter(base_ttl) for _ in range(50)}

    assert all(base_ttl <= value <= 330 for value in values)
    assert values


def test_ttl_with_jitter_handles_non_positive_values() -> None:
    assert ttl_with_jitter(0) == 1
    assert ttl_with_jitter(-5) == 1
