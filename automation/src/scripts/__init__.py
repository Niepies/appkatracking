# automation/src/scripts/__init__.py
"""
Rejestr skryptów automatyzacji.
Aby dodać nowy serwis, zaimportuj go tutaj i dodaj do AUTOMATION_REGISTRY.
"""
from __future__ import annotations

from src.scripts.base_automation import BaseAutomation
from src.scripts.netflix import NetflixAutomation
from src.scripts.spotify import SpotifyAutomation
from src.scripts.disney_plus import DisneyPlusAutomation
from src.scripts.max import MaxAutomation
from src.scripts.generic import GenericAutomation

# Mapowanie service_key -> klasa automatyzacji
AUTOMATION_REGISTRY: dict[str, type[BaseAutomation]] = {
    "netflix":    NetflixAutomation,
    "spotify":    SpotifyAutomation,
    "disney+":    DisneyPlusAutomation,
    "disneyplus": DisneyPlusAutomation,
    "max":        MaxAutomation,
    "hbomax":     MaxAutomation,
    "hbo":        MaxAutomation,
    "hbo max":    MaxAutomation,
}


def get_automation(service_key: str) -> BaseAutomation:
    """
    Zwraca instancję automatyzatora dla danego serwisu.
    Jeśli nie ma dedykowanego skryptu, zwraca GenericAutomation.
    """
    cls = AUTOMATION_REGISTRY.get(service_key.lower())
    if cls:
        return cls()
    return GenericAutomation(target_service_key=service_key.lower())


__all__ = ["get_automation", "AUTOMATION_REGISTRY"]
