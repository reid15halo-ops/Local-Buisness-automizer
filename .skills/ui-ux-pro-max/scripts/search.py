#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UI/UX Pro Max Search - CLI entry point for design system search and generation.

Usage:
    python3 search.py "<query>" --domain <domain> [-n <max_results>]
    python3 search.py "<query>" --stack <stack>
    python3 search.py "<query>" --design-system [-p "Project Name"] [-f ascii|markdown]
    python3 search.py "<query>" --design-system --persist [-p "Project Name"] [--page "page-name"]
"""

import argparse
import json
import io
import sys

# Force UTF-8 for Windows emoji support
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from core import CSV_CONFIG, STACK_CONFIG, AVAILABLE_STACKS, MAX_RESULTS, search, search_stack
from design_system import generate_design_system


def truncate_value(value, max_len=300):
    """Truncate long values for token-optimized output."""
    value = str(value)
    if len(value) > max_len:
        return value[:max_len] + "..."
    return value


def format_output(result, output_format="text"):
    """Format search results for display."""
    if output_format == "json":
        return json.dumps(result, indent=2, ensure_ascii=False)

    lines = []
    domain = result.get("domain", "unknown")
    query = result.get("query", "")
    count = result.get("count", 0)
    source_file = result.get("file", "")

    lines.append(f"Domain: {domain} | Query: \"{query}\" | Results: {count} | Source: {source_file}")
    lines.append("-" * 80)

    for i, item in enumerate(result.get("results", []), 1):
        lines.append(f"\n--- Result {i} ---")
        for key, value in item.items():
            if value:
                lines.append(f"  {key}: {truncate_value(value)}")

    if count == 0:
        lines.append("\nNo results found. Try different keywords.")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="UI/UX Pro Max - Design Intelligence Search",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 search.py "minimalism dark mode" --domain style
  python3 search.py "SaaS dashboard" --design-system -p "My App"
  python3 search.py "navigation" --stack react-native
  python3 search.py "fintech crypto" --design-system --persist -p "CryptoApp"
        """
    )

    parser.add_argument("query", help="Search query (e.g., 'minimalism dark mode')")
    parser.add_argument("--domain", "-d", type=str, default=None,
                        choices=list(CSV_CONFIG.keys()),
                        help="Search domain (auto-detected if omitted)")
    parser.add_argument("--stack", "-s", type=str, default=None,
                        choices=AVAILABLE_STACKS,
                        help="Stack-specific search")
    parser.add_argument("--design-system", "--ds", action="store_true",
                        help="Generate complete design system recommendation")
    parser.add_argument("--persist", action="store_true",
                        help="Save design system to design-system/ folder")
    parser.add_argument("--page", type=str, default=None,
                        help="Page name for page-specific override (used with --persist)")
    parser.add_argument("--project-name", "-p", type=str, default=None,
                        help="Project name for output header")
    parser.add_argument("-n", "--max-results", type=int, default=MAX_RESULTS,
                        help=f"Maximum results (default: {MAX_RESULTS})")
    parser.add_argument("-f", "--format", type=str, default="ascii",
                        choices=["ascii", "markdown", "json"],
                        help="Output format (default: ascii)")
    parser.add_argument("--output-dir", type=str, default=None,
                        help="Output directory for --persist (default: current directory)")

    args = parser.parse_args()

    # Priority: design-system > stack > domain search
    if args.design_system:
        result = generate_design_system(
            query=args.query,
            project_name=args.project_name,
            output_format="markdown" if args.format == "markdown" else "ascii",
            persist=args.persist,
            page=args.page,
            output_dir=args.output_dir
        )
        print(result)
    elif args.stack:
        result = search_stack(args.query, args.stack, args.max_results)
        if "error" in result:
            print(f"Error: {result['error']}", file=sys.stderr)
            sys.exit(1)
        print(format_output(result, args.format))
    else:
        result = search(args.query, args.domain, args.max_results)
        if "error" in result:
            print(f"Error: {result['error']}", file=sys.stderr)
            sys.exit(1)
        print(format_output(result, args.format))


if __name__ == "__main__":
    main()
