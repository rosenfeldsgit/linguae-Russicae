"""Losslessly compress the complete local fonts; pip install -r scripts/font-requirements.txt."""
from pathlib import Path
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]


def build():
    before = after = 0
    for source in sorted((ROOT / 'assets/fonts').glob('*.ttf')):
        target = source.with_suffix('.woff2')
        with TTFont(source, recalcTimestamp=False) as font:
            font.flavor = 'woff2'
            font.save(target)
        # Keep every glyph, Unicode mapping and advance width, including Cyrillic.
        with TTFont(source) as original, TTFont(target) as compressed:
            assert original.getBestCmap() == compressed.getBestCmap(), source
            assert original.getGlyphOrder() == compressed.getGlyphOrder(), source
            assert original['hmtx'].metrics == compressed['hmtx'].metrics, source
        before += source.stat().st_size
        after += target.stat().st_size
    print(f'Fonts: {before} -> {after} bytes ({100 * (1 - after / before):.1f}% smaller)')


if __name__ == '__main__':
    build()
