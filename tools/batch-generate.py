#!/usr/bin/env python3
"""
Batch PDF Generator
Generate multiple PDFs from a JSON array of documents
"""

import json
import sys
import argparse
from pathlib import Path
import importlib.util

# Import the main generator
spec = importlib.util.spec_from_file_location(
    "pdf_generator",
    str(Path(__file__).parent / "pdf-generator.py")
)
pdf_generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pdf_generator)
GermanBusinessPDFGenerator = pdf_generator.GermanBusinessPDFGenerator


def generate_batch(data_list, output_dir=None):
    """
    Generate multiple PDFs from a list of document data

    Args:
        data_list: List of document data dictionaries
        output_dir: Output directory for PDFs (default: current dir)

    Returns:
        Dictionary with results and statistics
    """

    if output_dir is None:
        output_dir = Path.cwd()
    else:
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

    results = {
        'total': len(data_list),
        'successful': 0,
        'failed': 0,
        'files': [],
        'errors': []
    }

    for idx, data in enumerate(data_list, 1):
        try:
            # Validate data
            if not isinstance(data, dict):
                raise ValueError(f"Document {idx}: Expected dict, got {type(data)}")

            if 'type' not in data:
                raise ValueError(f"Document {idx}: Missing 'type' field")

            if 'number' not in data:
                raise ValueError(f"Document {idx}: Missing 'number' field")

            # Generate filename
            doc_type = data['type']
            doc_number = data['number'].replace('/', '-').replace(' ', '-')
            filename = f"{doc_type}_{doc_number}.pdf"
            output_path = output_dir / filename

            # Generate PDF
            print(f"[{idx}/{len(data_list)}] Generating {doc_type}: {data['number']}...", end=' ')
            generator = GermanBusinessPDFGenerator(data)
            success = generator.generate(str(output_path))

            if success and output_path.exists():
                file_size = output_path.stat().st_size
                print(f"✓ ({file_size} bytes)")
                results['successful'] += 1
                results['files'].append({
                    'type': doc_type,
                    'number': data['number'],
                    'filename': filename,
                    'path': str(output_path),
                    'size': file_size
                })
            else:
                print("✗ (generation failed)")
                results['failed'] += 1
                results['errors'].append({
                    'document': f"{doc_type}: {data['number']}",
                    'error': 'PDF generation failed'
                })

        except Exception as e:
            print(f"✗ ({str(e)})")
            results['failed'] += 1
            results['errors'].append({
                'document': f"Document {idx}",
                'error': str(e)
            })

    return results


def print_summary(results):
    """Print batch generation summary"""
    print("\n" + "=" * 60)
    print("Batch Generation Summary")
    print("=" * 60)
    print(f"Total Documents: {results['total']}")
    print(f"Successful:      {results['successful']}")
    print(f"Failed:          {results['failed']}")

    if results['files']:
        print("\nGenerated Files:")
        for file_info in results['files']:
            print(f"  ✓ {file_info['filename']:30} ({file_info['type']:8}) {file_info['size']:6} bytes")

    if results['errors']:
        print("\nErrors:")
        for error in results['errors']:
            print(f"  ✗ {error['document']:30} {error['error']}")

    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description='Batch generate PDF documents'
    )
    parser.add_argument(
        '--input',
        required=True,
        help='Input JSON file with document array'
    )
    parser.add_argument(
        '--output',
        default='.',
        help='Output directory for PDFs (default: current directory)'
    )
    parser.add_argument(
        '--summary',
        action='store_true',
        help='Print summary after generation'
    )

    args = parser.parse_args()

    # Load input file
    try:
        with open(args.input, 'r') as f:
            data_list = json.load(f)

        if not isinstance(data_list, list):
            print("Error: Input JSON must be an array of documents")
            sys.exit(1)

    except FileNotFoundError:
        print(f"Error: Input file not found: {args.input}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in input file: {e}")
        sys.exit(1)

    # Generate batch
    print(f"\nStarting batch generation...")
    print(f"Documents: {len(data_list)}")
    print(f"Output directory: {args.output}\n")

    results = generate_batch(data_list, args.output)

    # Print summary
    if args.summary or True:  # Always print summary
        print_summary(results)

    # Exit with appropriate code
    sys.exit(0 if results['failed'] == 0 else 1)


if __name__ == '__main__':
    main()
