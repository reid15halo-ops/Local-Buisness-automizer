#!/usr/bin/env python3
"""
Professional German Business PDF Generator
Generates Angebote (Quotes), Rechnungen (Invoices), and Mahnungen (Dunning Notices)
Uses ReportLab for professional PDF creation
"""

import json
import sys
import argparse
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
from io import BytesIO
from pathlib import Path

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm, cm
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
    from reportlab.pdfgen import canvas
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
        PageBreak, Image, KeepTogether
    )
    from reportlab.lib import colors
except ImportError:
    print("Error: reportlab is not installed. Install it with:")
    print("pip install reportlab --break-system-packages")
    sys.exit(1)


class GermanBusinessPDFGenerator:
    """Main class for generating professional German business PDFs"""

    # Design constants
    PAGE_WIDTH, PAGE_HEIGHT = A4
    MARGIN_TOP = 20 * mm
    MARGIN_RIGHT = 15 * mm
    MARGIN_BOTTOM = 20 * mm
    MARGIN_LEFT = 15 * mm

    # Colors
    COLOR_DARK = colors.HexColor('#1a1a2e')
    COLOR_INDIGO = colors.HexColor('#6366f1')
    COLOR_LIGHT_GRAY = colors.HexColor('#f5f5f5')
    COLOR_BORDER = colors.HexColor('#e0e0e0')
    COLOR_TEXT = colors.HexColor('#333333')

    def __init__(self, data: Dict):
        """Initialize PDF generator with data"""
        self.data = data
        self.company = data.get('company', {})
        self.customer = data.get('customer', {})
        self.positions = data.get('positions', [])
        self.doc_type = data.get('type', 'angebot')  # angebot, rechnung, mahnung

    def format_german_date(self, date_str: Optional[str] = None) -> str:
        """Format date in German format (DD.MM.YYYY)"""
        if isinstance(date_str, str):
            dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        else:
            dt = datetime.now()
        return dt.strftime('%d.%m.%Y')

    def format_german_number(self, value: float) -> str:
        """Format number in German format (1.234,56)"""
        return f"{value:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')

    def format_currency(self, value: float) -> str:
        """Format value as German currency (1.234,56 €)"""
        return f"{self.format_german_number(value)} €"

    def add_days(self, date_str: str, days: int) -> str:
        """Add days to date and return formatted string"""
        dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        new_dt = dt + timedelta(days=days)
        return new_dt.strftime('%d.%m.%Y')

    def create_header(self) -> Tuple[List, float]:
        """Create document header with company info"""
        elements = []

        # Top header bar
        header_data = [[
            Paragraph(
                f"<font size=18 color='white'><b>{self.company.get('name', 'Firmennname')}</b></font>",
                self._get_style('header')
            )
        ]]

        header_table = Table(header_data, colWidths=[self.PAGE_WIDTH - self.MARGIN_LEFT - self.MARGIN_RIGHT])
        header_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), self.COLOR_DARK),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ]))

        elements.append(header_table)
        elements.append(Spacer(1, 5 * mm))

        # Company info line
        company_info = f"{self.company.get('street', '')}, {self.company.get('postal_code', '')} {self.company.get('city', '')}"
        info_style = self._get_style('normal')
        info_style.fontSize = 8
        info_style.textColor = self.COLOR_TEXT

        elements.append(Paragraph(
            f"<font size=8>{company_info} | Tel: {self.company.get('phone', '')} | E-Mail: {self.company.get('email', '')}</font>",
            info_style
        ))
        elements.append(Spacer(1, 8 * mm))

        return elements, 33 * mm

    def create_document_title(self) -> List:
        """Create document title based on type"""
        elements = []

        titles = {
            'angebot': 'Angebot',
            'rechnung': 'Rechnung',
            'mahnung': 'Zahlungserinnerung'
        }

        title = titles.get(self.doc_type, 'Dokument')
        nummer = self.data.get('number', 'XXXX')

        title_text = f"<font size=16><b>{title} Nr. {nummer}</b></font>"
        elements.append(Paragraph(title_text, self._get_style('title')))
        elements.append(Spacer(1, 3 * mm))

        return elements

    def create_info_block(self) -> List:
        """Create info block with dates and details"""
        elements = []

        data_rows = []

        # Document date
        doc_date = self.data.get('date', datetime.now().isoformat())
        data_rows.append(('Datum:', self.format_german_date(doc_date)))

        # Document-specific fields
        if self.doc_type == 'angebot':
            valid_until = self.add_days(doc_date, 30)
            data_rows.append(('Gültig bis:', valid_until))
        elif self.doc_type == 'rechnung':
            due_date = self.data.get('due_date', self.add_days(doc_date, 14))
            data_rows.append(('Zahlungsziel:', due_date))
        elif self.doc_type == 'mahnung':
            original_invoice = self.data.get('original_invoice_number', 'RE-XXXX')
            data_rows.append(('Ursprüngliche Rechnung:', original_invoice))

        # Create table
        info_data = [[Paragraph(f"<b>{k}</b>", self._get_style('normal')),
                      Paragraph(v, self._get_style('normal'))]
                     for k, v in data_rows]

        info_table = Table(info_data, colWidths=[40*mm, 80*mm])
        info_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))

        elements.append(info_table)
        elements.append(Spacer(1, 8 * mm))

        return elements

    def create_customer_block(self) -> List:
        """Create customer address block"""
        elements = []

        # Add spacing
        elements.append(Spacer(1, 3 * mm))

        # Customer section title
        elements.append(Paragraph(
            "<font size=9><b>Auftraggeber</b></font>",
            self._get_style('normal')
        ))
        elements.append(Spacer(1, 2 * mm))

        # Customer address
        customer_lines = []
        if self.customer.get('company'):
            customer_lines.append(self.customer['company'])
        customer_lines.append(self.customer.get('name', 'Kunde'))
        customer_lines.append(f"{self.customer.get('street', '')}")
        customer_lines.append(f"{self.customer.get('postal_code', '')} {self.customer.get('city', '')}")

        customer_text = '<br/>'.join(customer_lines)
        elements.append(Paragraph(
            f"<font size=9>{customer_text}</font>",
            self._get_style('normal')
        ))
        elements.append(Spacer(1, 6 * mm))

        return elements

    def _build_position_description(self, pos: Dict) -> 'Paragraph':
        """Build a multi-line Paragraph for position description cell"""
        desc_style = ParagraphStyle(
            'PosDesc',
            fontName='Helvetica-Bold',
            fontSize=9,
            textColor=self.COLOR_TEXT,
            leading=12,
            spaceAfter=2
        )
        detail_style = ParagraphStyle(
            'PosDetail',
            fontName='Helvetica',
            fontSize=8,
            textColor=colors.HexColor('#555555'),
            leading=11,
            spaceBefore=3,
            spaceAfter=2
        )
        verantw_style = ParagraphStyle(
            'PosVerantw',
            fontName='Helvetica-Bold',
            fontSize=8,
            textColor=self.COLOR_INDIGO,
            leading=11,
            spaceBefore=2
        )

        description = pos.get('description', '')
        details = pos.get('details', '').strip()
        verantwortlich = pos.get('verantwortlich', '').strip()

        parts = []
        parts.append(Paragraph(description, desc_style))
        if details:
            # Wrap long detail text at 400 chars per line gracefully
            parts.append(Paragraph(details, detail_style))
        if verantwortlich:
            parts.append(Paragraph(f'Zustandig: {verantwortlich}', verantw_style))

        from reportlab.platypus import KeepTogether
        return parts

    def create_positions_table(self) -> List:
        """Create positions/line items table with detailed multi-line descriptions"""
        elements = []

        # Section header
        section_style = ParagraphStyle(
            'SectionHeader',
            fontName='Helvetica-Bold',
            fontSize=10,
            textColor=self.COLOR_DARK,
            leading=14,
            spaceAfter=4
        )
        elements.append(Paragraph('Leistungsubersicht', section_style))
        elements.append(Spacer(1, 2 * mm))

        # Table header row
        header_style = ParagraphStyle(
            'TableHeader',
            fontName='Helvetica-Bold',
            fontSize=9,
            textColor=colors.white,
            leading=12
        )
        headers = [
            Paragraph('Pos.', header_style),
            Paragraph('Leistung &amp; Beschreibung', header_style),
            Paragraph('Menge', header_style),
            Paragraph('Einheit', header_style),
            Paragraph('Einzelpreis', header_style),
            Paragraph('Gesamtpreis', header_style),
        ]

        table_data = [headers]

        normal_style = ParagraphStyle(
            'TableCell',
            fontName='Helvetica',
            fontSize=9,
            textColor=self.COLOR_TEXT,
            leading=12
        )
        num_style = ParagraphStyle(
            'TableNum',
            fontName='Helvetica',
            fontSize=9,
            textColor=self.COLOR_TEXT,
            leading=12,
            alignment=2  # RIGHT
        )

        # Add positions — each position gets a KeepTogether group of Paragraphs
        for idx, pos in enumerate(self.positions, 1):
            quantity = float(pos.get('quantity', 1))
            unit_price = float(pos.get('unit_price', 0))
            total_price = quantity * unit_price

            # Description column: multi-line (title + details + verantwortlich)
            desc_parts = self._build_position_description(pos)

            # Wrap description parts in a nested table so they stay together in the cell
            if len(desc_parts) > 1:
                inner_table = Table(
                    [[p] for p in desc_parts],
                    colWidths=[76 * mm]
                )
                inner_table.setStyle(TableStyle([
                    ('LEFTPADDING', (0, 0), (-1, -1), 0),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                    ('TOPPADDING', (0, 0), (-1, -1), 1),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
                ]))
                desc_cell = inner_table
            else:
                desc_cell = desc_parts[0] if desc_parts else Paragraph('', normal_style)

            table_data.append([
                Paragraph(str(idx), normal_style),
                desc_cell,
                Paragraph(self.format_german_number(quantity), num_style),
                Paragraph(pos.get('unit', 'Std.'), normal_style),
                Paragraph(self.format_currency(unit_price), num_style),
                Paragraph(self.format_currency(total_price), num_style),
            ])

        # colWidths: pos(8) + desc(78) + qty(15) + unit(16) + ep(26) + gp(27) = 170mm
        table = Table(table_data,
                      colWidths=[8 * mm, 78 * mm, 15 * mm, 16 * mm, 26 * mm, 27 * mm],
                      repeatRows=1)

        row_styles = [
            # Header styling
            ('BACKGROUND', (0, 0), (-1, 0), self.COLOR_DARK),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, 0), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 9),
            ('TOPPADDING', (0, 0), (-1, 0), 9),

            # Data rows
            ('VALIGN', (0, 1), (-1, -1), 'TOP'),
            ('ALIGN', (0, 1), (0, -1), 'CENTER'),
            ('ALIGN', (2, 1), (-1, -1), 'RIGHT'),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
            ('LEFTPADDING', (0, 1), (-1, -1), 6),
            ('RIGHTPADDING', (0, 1), (-1, -1), 6),

            # Alternating row colors
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, self.COLOR_LIGHT_GRAY]),

            # Borders
            ('LINEBELOW', (0, 0), (-1, 0), 1, self.COLOR_DARK),
            ('LINEBELOW', (0, 1), (-1, -1), 0.3, self.COLOR_BORDER),
            ('BOX', (0, 0), (-1, -1), 0.5, self.COLOR_BORDER),
        ]

        table.setStyle(TableStyle(row_styles))

        elements.append(table)
        elements.append(Spacer(1, 8 * mm))

        return elements

    def create_totals_block(self) -> List:
        """Create totals section"""
        elements = []

        # Calculate totals
        subtotal = sum(float(pos.get('quantity', 1)) * float(pos.get('unit_price', 0))
                      for pos in self.positions)
        vat_rate = 0.19 if self.doc_type != 'rechnung' or not self.data.get('exempt_vat') else 0
        vat_amount = subtotal * vat_rate
        total = subtotal + vat_amount

        # Totals data
        totals_data = []

        if self.doc_type == 'rechnung' and self.data.get('exempt_vat'):
            totals_data.append(('Gesamtbetrag (netto):', self.format_currency(subtotal)))
            totals_data.append(('Gemäß §19 UStG wird keine Umsatzsteuer berechnet',))
        else:
            totals_data.append(('Zwischensumme:', self.format_currency(subtotal)))
            totals_data.append(('MwSt. (19%):', self.format_currency(vat_amount)))
            totals_data.append(('Gesamtbetrag:', self.format_currency(total)))

        # Create table
        table_rows = []
        for row in totals_data:
            if len(row) == 2:
                label, value = row
                table_rows.append([
                    Paragraph(f"<b>{label}</b>", self._get_style('normal')),
                    Paragraph(f"<b>{value}</b>", self._get_style('normal'))
                ])
            else:
                # Special row for exempt notice
                table_rows.append([
                    Paragraph(f"<i>{row[0]}</i>", self._get_style('normal')),
                    Paragraph('', self._get_style('normal'))
                ])

        totals_table = Table(table_rows, colWidths=[100*mm, 30*mm])
        totals_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LINEBELOW', (0, -1), (-1, -1), 1.5, self.COLOR_INDIGO) if totals_data[-1][0].startswith('Gesamtbetrag') else None,
        ]))

        elements.append(totals_table)
        elements.append(Spacer(1, 6 * mm))

        return elements

    def create_intro_section(self) -> List:
        """Create introductory text section from the quote's angebot text"""
        elements = []
        text = self.data.get('text', '').strip()
        if not text:
            return elements

        intro_style = ParagraphStyle(
            'IntroText',
            fontName='Helvetica',
            fontSize=9,
            textColor=self.COLOR_TEXT,
            leading=14,
            spaceAfter=4
        )

        # Replace newlines with <br/> for ReportLab
        formatted = text.replace('\n', '<br/>')
        elements.append(Paragraph(formatted, intro_style))
        elements.append(Spacer(1, 6 * mm))

        return elements

    def create_trust_section(self) -> List:
        """Create trust-building section with guarantees after the totals"""
        elements = []

        if self.doc_type != 'angebot':
            return elements

        elements.append(Spacer(1, 4 * mm))

        section_style = ParagraphStyle(
            'TrustHeader',
            fontName='Helvetica-Bold',
            fontSize=9,
            textColor=self.COLOR_DARK,
            leading=12,
            spaceAfter=4
        )
        item_style = ParagraphStyle(
            'TrustItem',
            fontName='Helvetica',
            fontSize=8.5,
            textColor=colors.HexColor('#166534'),
            leading=13,
            leftIndent=8,
            spaceAfter=2
        )

        elements.append(Paragraph('Im Leistungsumfang enthalten:', section_style))
        elements.append(Spacer(1, 2 * mm))

        trust_items = self.data.get('trust_items', [
            'Alle Arbeiten werden durch qualifizierte Fachkrafte mit nachgewiesener Berufserfahrung ausgefuhrt',
            'Samtliche eingesetzten Materialien entsprechen den aktuellen DIN-Normen und gesetzlichen Vorschriften',
            'Nach Abschluss der Arbeiten erhalten Sie ein detailliertes Abnahmeprotokoll',
            'Gesetzliche Gewahrleistung auf alle ausgefuhrten Arbeiten (2 Jahre gemas BGB)',
            'Saubere und ordentliche Durchfuhrung – Ihr Eigentum wird wahrend der Arbeiten geschutzt',
            'Transparente Kommunikation – wir informieren Sie bei Bedarf vor jeder Anderung des Arbeitsumfangs',
        ])

        # Teal background box for trust items
        trust_data = [[Paragraph(f'* {item}', item_style)] for item in trust_items]
        trust_table = Table(trust_data, colWidths=[170 * mm])
        trust_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f0fdf4')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#86efac')),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(trust_table)
        elements.append(Spacer(1, 6 * mm))

        return elements

    def create_terms_section(self) -> List:
        """Create payment terms and conditions"""
        elements = []

        elements.append(Spacer(1, 3 * mm))

        if self.doc_type == 'angebot':
            terms_text = "<b>Zahlungsbedingungen:</b> 14 Tage netto"
        elif self.doc_type == 'rechnung':
            terms_text = "<b>Zahlungsziel:</b> 14 Tage netto"
        elif self.doc_type == 'mahnung':
            outstanding = self.data.get('outstanding_amount', 0)
            fee = self.data.get('dunning_fee', 0)
            terms_text = (f"<b>Ausstehender Betrag:</b> {self.format_currency(outstanding)}<br/>"
                         f"<b>Mahngebühr:</b> {self.format_currency(fee)}<br/>"
                         f"<font size=8><i>Bitte überweisen Sie den ausstehenden Betrag umgehend.</i></font>")

        style = self._get_style('normal')
        style.fontSize = 9
        elements.append(Paragraph(terms_text, style))

        return elements

    def create_footer(self) -> List:
        """Create footer with company legal information"""
        elements = []

        elements.append(Spacer(1, 5 * mm))

        footer_lines = [
            f"<b>{self.company.get('name', '')}</b>",
            f"Steuernummer: {self.company.get('tax_id', '')} | USt-ID: {self.company.get('vat_id', '')}",
            f"IBAN: {self.company.get('iban', '')} | BIC: {self.company.get('bic', '')}",
            f"Bank: {self.company.get('bank_name', '')}"
        ]

        footer_text = '<br/>'.join([line for line in footer_lines if any(line.split(': ')[-1].strip() for line in [line])])

        style = self._get_style('normal')
        style.fontSize = 7
        style.textColor = self.COLOR_BORDER

        elements.append(Paragraph(footer_text, style))

        return elements

    def _get_style(self, style_type: str) -> ParagraphStyle:
        """Get paragraph style"""
        styles = getSampleStyleSheet()

        if style_type == 'header':
            return ParagraphStyle(
                'CustomHeader',
                parent=styles['Normal'],
                fontSize=18,
                textColor=colors.white,
                fontName='Helvetica-Bold'
            )
        elif style_type == 'title':
            return ParagraphStyle(
                'CustomTitle',
                parent=styles['Normal'],
                fontSize=16,
                textColor=self.COLOR_DARK,
                fontName='Helvetica-Bold'
            )
        else:  # normal
            return ParagraphStyle(
                'CustomNormal',
                parent=styles['Normal'],
                fontSize=10,
                textColor=self.COLOR_TEXT,
                fontName='Helvetica'
            )

    def generate(self, output_path: str) -> bool:
        """Generate PDF and save to file"""
        try:
            # Create document
            doc = SimpleDocTemplate(
                output_path,
                pagesize=A4,
                topMargin=self.MARGIN_TOP,
                bottomMargin=self.MARGIN_BOTTOM,
                leftMargin=self.MARGIN_LEFT,
                rightMargin=self.MARGIN_RIGHT
            )

            # Build elements
            elements = []

            # Add header
            header_elements, header_height = self.create_header()
            elements.extend(header_elements)

            # Add document title
            elements.extend(self.create_document_title())

            # Add info block
            elements.extend(self.create_info_block())

            # Add customer block
            elements.extend(self.create_customer_block())

            # Add intro text (quote letter text) if present
            elements.extend(self.create_intro_section())

            # Add positions table
            elements.extend(self.create_positions_table())

            # Add totals
            elements.extend(self.create_totals_block())

            # Add trust/guarantee section (angebot only)
            elements.extend(self.create_trust_section())

            # Add terms
            elements.extend(self.create_terms_section())

            # Add footer
            elements.extend(self.create_footer())

            # Build PDF
            doc.build(elements)

            return True
        except Exception as e:
            print(f"Error generating PDF: {e}")
            import traceback
            traceback.print_exc()
            return False


def load_sample_data(doc_type: str) -> Dict:
    """Load sample data for testing"""

    base_company = {
        'name': 'FreyAI Visions',
        'street': 'Musterstraße 123',
        'postal_code': '63843',
        'city': 'Musterstadt',
        'phone': '+49 6029 9922964',
        'email': 'info@freyai-visions.de',
        'tax_id': '12 345 678 901',
        'vat_id': 'DE123456789',
        'iban': 'DE89 3704 0044 0532 0130 00',
        'bic': 'COBADEFFXXX',
        'bank_name': 'Commerzbank'
    }

    base_customer = {
        'company': 'Musterfirma GmbH',
        'name': 'Max Mustermann',
        'street': 'Kundenstraße 42',
        'postal_code': '60311',
        'city': 'Frankfurt am Main'
    }

    base_positions = [
        {
            'description': 'Montage Hydraulikanlage inkl. Material',
            'quantity': 16,
            'unit': 'Std.',
            'unit_price': 75.00
        },
        {
            'description': 'Hydrauliköl (Typ HL46) 205 Liter Fass',
            'quantity': 2,
            'unit': 'Stück',
            'unit_price': 145.50
        },
        {
            'description': 'Dichtungen und Verschleißteile',
            'quantity': 1,
            'unit': 'Paket',
            'unit_price': 320.00
        }
    ]

    now = datetime.now().isoformat()

    if doc_type == 'angebot':
        return {
            'type': 'angebot',
            'number': 'ANG-2024-001',
            'date': now,
            'company': base_company,
            'customer': base_customer,
            'positions': base_positions
        }

    elif doc_type == 'rechnung':
        return {
            'type': 'rechnung',
            'number': 'RE-2024-001',
            'date': now,
            'due_date': (datetime.now() + timedelta(days=14)).strftime('%d.%m.%Y'),
            'company': base_company,
            'customer': base_customer,
            'positions': base_positions,
            'exempt_vat': False
        }

    elif doc_type == 'mahnung':
        return {
            'type': 'mahnung',
            'number': 'MA-2024-001',
            'date': now,
            'original_invoice_number': 'RE-2024-001',
            'outstanding_amount': 1875.00,
            'dunning_fee': 50.00,
            'company': base_company,
            'customer': base_customer,
            'positions': base_positions
        }

    return {}


def main():
    parser = argparse.ArgumentParser(
        description='Generate professional German business PDFs'
    )
    parser.add_argument(
        '--type',
        choices=['angebot', 'rechnung', 'mahnung'],
        default='angebot',
        help='Document type'
    )
    parser.add_argument(
        '--data',
        help='JSON data string (overrides sample data)'
    )
    parser.add_argument(
        '--output',
        required=True,
        help='Output PDF file path'
    )
    parser.add_argument(
        '--sample',
        action='store_true',
        help='Generate sample PDFs'
    )

    args = parser.parse_args()

    # Load data
    if args.data:
        try:
            data = json.loads(args.data)
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON: {e}")
            sys.exit(1)
    else:
        data = load_sample_data(args.type)

    # Generate PDF
    generator = GermanBusinessPDFGenerator(data)
    success = generator.generate(args.output)

    if success:
        print(f"PDF generated successfully: {args.output}")
        sys.exit(0)
    else:
        print(f"Failed to generate PDF")
        sys.exit(1)


if __name__ == '__main__':
    main()
