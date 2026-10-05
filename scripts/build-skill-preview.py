"""Export the interactive study and v4 game as self-contained HTML files."""
import argparse
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def bundle(source: Path, destination: Path) -> None:
    def inline(match: re.Match) -> str:
        script = (source.parent / match.group(1)).resolve()
        if not script.is_relative_to(ROOT):
            raise ValueError(f"Script outside repository: {script}")
        code = script.read_text(encoding="utf-8")
        if "</script" in code.lower():
            raise ValueError(f"Script needs HTML escaping: {script}")
        return "<script>\n" + code + "\n</script>"

    html = re.sub(r'<script src="([^"]+)"></script>', inline, source.read_text(encoding="utf-8"))
    html = html.replace('href="../v4/index.html"', 'href="game-with-effects.html"')
    destination.write_text(html, encoding="utf-8")
    print(f"{destination} ({destination.stat().st_size:,} bytes)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="Directory for the exported HTML files")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    bundle(ROOT / "concepts/v4-skill-effects.html", args.output / "skill-effects.html")
    bundle(ROOT / "v4/index.html", args.output / "game-with-effects.html")
    bundle(ROOT / "concepts/v4-enemy-encounters.html", args.output / "enemy-encounters.html")
