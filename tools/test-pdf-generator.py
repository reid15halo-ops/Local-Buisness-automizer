#!/usr/bin/env python3
"""
Test suite for PDF Generator
Validates all document types and features
"""

import json
import sys
import os
from pathlib import Path
from datetime import datetime, timedelta

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Import directly
try:
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "pdf_generator",
        str(Path(__file__).parent / "pdf-generator.py")
    )
    pdf_generator = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(pdf_generator)
    GermanBusinessPDFGenerator = pdf_generator.GermanBusinessPDFGenerator
    load_sample_data = pdf_generator.load_sample_data
except Exception as e:
    print(f"Error importing pdf_generator: {e}")
    sys.exit(1)


class PDFGeneratorTests:
    """Test suite for PDF generator"""

    def __init__(self):
        self.tests_passed = 0
        self.tests_failed = 0
        self.output_dir = Path(__file__).parent / 'test_output'
        self.output_dir.mkdir(exist_ok=True)

    def test_sample_data_loading(self):
        """Test loading sample data for all document types"""
        print("\n=== Test: Sample Data Loading ===")

        for doc_type in ['angebot', 'rechnung', 'mahnung']:
            try:
                data = load_sample_data(doc_type)
                assert data.get('type') == doc_type
                assert data.get('number') is not None
                assert data.get('company') is not None
                assert data.get('customer') is not None
                assert data.get('positions') is not None
                print(f"✓ {doc_type}: Sample data loaded successfully")
                self.tests_passed += 1
            except Exception as e:
                print(f"✗ {doc_type}: Failed to load sample data - {e}")
                self.tests_failed += 1

    def test_pdf_generation_angebot(self):
        """Test Angebot PDF generation"""
        print("\n=== Test: Angebot PDF Generation ===")

        try:
            data = load_sample_data('angebot')
            generator = GermanBusinessPDFGenerator(data)
            output_file = self.output_dir / 'test_angebot.pdf'

            success = generator.generate(str(output_file))

            if success and output_file.exists():
                file_size = output_file.stat().st_size
                print(f"✓ Angebot PDF generated successfully ({file_size} bytes)")
                self.tests_passed += 1
            else:
                print("✗ Angebot PDF generation failed - file not created")
                self.tests_failed += 1

        except Exception as e:
            print(f"✗ Angebot PDF generation failed - {e}")
            self.tests_failed += 1

    def test_pdf_generation_rechnung(self):
        """Test Rechnung PDF generation"""
        print("\n=== Test: Rechnung PDF Generation ===")

        try:
            data = load_sample_data('rechnung')
            generator = GermanBusinessPDFGenerator(data)
            output_file = self.output_dir / 'test_rechnung.pdf'

            success = generator.generate(str(output_file))

            if success and output_file.exists():
                file_size = output_file.stat().st_size
                print(f"✓ Rechnung PDF generated successfully ({file_size} bytes)")
                self.tests_passed += 1
            else:
                print("✗ Rechnung PDF generation failed - file not created")
                self.tests_failed += 1

        except Exception as e:
            print(f"✗ Rechnung PDF generation failed - {e}")
            self.tests_failed += 1

    def test_pdf_generation_mahnung(self):
        """Test Mahnung PDF generation"""
        print("\n=== Test: Mahnung PDF Generation ===")

        try:
            data = load_sample_data('mahnung')
            generator = GermanBusinessPDFGenerator(data)
            output_file = self.output_dir / 'test_mahnung.pdf'

            success = generator.generate(str(output_file))

            if success and output_file.exists():
                file_size = output_file.stat().st_size
                print(f"✓ Mahnung PDF generated successfully ({file_size} bytes)")
                self.tests_passed += 1
            else:
                print("✗ Mahnung PDF generation failed - file not created")
                self.tests_failed += 1

        except Exception as e:
            print(f"✗ Mahnung PDF generation failed - {e}")
            self.tests_failed += 1

    def test_german_number_formatting(self):
        """Test German number formatting"""
        print("\n=== Test: German Number Formatting ===")

        try:
            data = load_sample_data('angebot')
            generator = GermanBusinessPDFGenerator(data)

            test_cases = [
                (1234.56, '1.234,56'),
                (100.00, '100,00'),
                (1000000.99, '1.000.000,99'),
                (0.50, '0,50'),
            ]

            all_passed = True
            for value, expected in test_cases:
                result = generator.format_german_number(value)
                if result == expected:
                    print(f"  ✓ {value} → {result}")
                else:
                    print(f"  ✗ {value} → {result} (expected {expected})")
                    all_passed = False

            if all_passed:
                self.tests_passed += 1
            else:
                self.tests_failed += 1

        except Exception as e:
            print(f"✗ German number formatting test failed - {e}")
            self.tests_failed += 1

    def test_currency_formatting(self):
        """Test currency formatting"""
        print("\n=== Test: Currency Formatting ===")

        try:
            data = load_sample_data('angebot')
            generator = GermanBusinessPDFGenerator(data)

            test_cases = [
                (1234.56, '1.234,56 €'),
                (100.00, '100,00 €'),
                (1500.00, '1.500,00 €'),
            ]

            all_passed = True
            for value, expected in test_cases:
                result = generator.format_currency(value)
                if result == expected:
                    print(f"  ✓ {value} → {result}")
                else:
                    print(f"  ✗ {value} → {result} (expected {expected})")
                    all_passed = False

            if all_passed:
                self.tests_passed += 1
            else:
                self.tests_failed += 1

        except Exception as e:
            print(f"✗ Currency formatting test failed - {e}")
            self.tests_failed += 1

    def test_date_formatting(self):
        """Test German date formatting"""
        print("\n=== Test: German Date Formatting ===")

        try:
            data = load_sample_data('angebot')
            generator = GermanBusinessPDFGenerator(data)

            test_date = "2026-02-16T10:00:00"
            result = generator.format_german_date(test_date)
            expected = "16.02.2026"

            if result == expected:
                print(f"  ✓ {test_date} → {result}")
                self.tests_passed += 1
            else:
                print(f"  ✗ {test_date} → {result} (expected {expected})")
                self.tests_failed += 1

        except Exception as e:
            print(f"✗ Date formatting test failed - {e}")
            self.tests_failed += 1

    def test_data_validation(self):
        """Test data validation and error handling"""
        print("\n=== Test: Data Validation ===")

        try:
            # Test with minimal data
            minimal_data = {
                'type': 'angebot',
                'number': 'TEST-001',
                'company': {'name': 'Test Company'},
                'customer': {'name': 'Test Customer'},
                'positions': []
            }

            generator = GermanBusinessPDFGenerator(minimal_data)
            output_file = self.output_dir / 'test_minimal.pdf'

            success = generator.generate(str(output_file))

            if success and output_file.exists():
                print("✓ Minimal data validation passed")
                self.tests_passed += 1
            else:
                print("✗ Minimal data validation failed")
                self.tests_failed += 1

        except Exception as e:
            print(f"✗ Data validation test failed - {e}")
            self.tests_failed += 1

    def test_custom_data(self):
        """Test PDF generation with custom data"""
        print("\n=== Test: Custom Data Generation ===")

        try:
            custom_data = {
                'type': 'rechnung',
                'number': 'RE-CUSTOM-001',
                'date': datetime.now().isoformat(),
                'company': {
                    'name': 'Custom Test Company',
                    'street': 'Test Street 42',
                    'postal_code': '12345',
                    'city': 'Test City',
                    'phone': '+49 123 456789',
                    'email': 'test@custom.de',
                    'tax_id': '98 765 432 101',
                    'vat_id': 'DE987654321',
                    'iban': 'DE89 3704 0044 0532 0130 00',
                    'bic': 'COBADEFFXXX',
                    'bank_name': 'Test Bank'
                },
                'customer': {
                    'name': 'Custom Customer',
                    'street': 'Customer Street 1',
                    'postal_code': '54321',
                    'city': 'Customer City'
                },
                'positions': [
                    {
                        'description': 'Custom Service',
                        'quantity': 5,
                        'unit': 'Std.',
                        'unit_price': 100.00
                    }
                ],
                'exempt_vat': False
            }

            generator = GermanBusinessPDFGenerator(custom_data)
            output_file = self.output_dir / 'test_custom.pdf'

            success = generator.generate(str(output_file))

            if success and output_file.exists():
                file_size = output_file.stat().st_size
                print(f"✓ Custom data PDF generated successfully ({file_size} bytes)")
                self.tests_passed += 1
            else:
                print("✗ Custom data PDF generation failed")
                self.tests_failed += 1

        except Exception as e:
            print(f"✗ Custom data test failed - {e}")
            self.tests_failed += 1

    def run_all_tests(self):
        """Run all tests"""
        print("=" * 50)
        print("PDF Generator Test Suite")
        print("=" * 50)

        self.test_sample_data_loading()
        self.test_german_number_formatting()
        self.test_currency_formatting()
        self.test_date_formatting()
        self.test_data_validation()
        self.test_pdf_generation_angebot()
        self.test_pdf_generation_rechnung()
        self.test_pdf_generation_mahnung()
        self.test_custom_data()

        print("\n" + "=" * 50)
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_failed}")
        print("=" * 50)

        return self.tests_failed == 0


def main():
    """Main test runner"""
    tester = PDFGeneratorTests()
    success = tester.run_all_tests()

    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
