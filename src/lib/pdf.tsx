import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import { amountInWords } from './number-to-words';

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: 'Helvetica', color: '#1f2937' },
  header: { marginBottom: 24, borderBottom: '2 solid #4f46e5', paddingBottom: 12 },
  companyName: { fontSize: 20, fontWeight: 700, color: '#4338ca' },
  title: { fontSize: 14, fontWeight: 700, marginBottom: 12, marginTop: 20 },
  paragraph: { marginBottom: 10, lineHeight: 1.6 },
  row: { flexDirection: 'row', marginBottom: 6 },
  label: { width: 140, fontWeight: 700, color: '#4b5563' },
  value: { flex: 1 },
  table: { marginTop: 12, marginBottom: 12, border: '1 solid #e5e7eb' },
  tableRow: { flexDirection: 'row', borderBottom: '1 solid #e5e7eb' },
  tableRowLast: { flexDirection: 'row' },
  tableCellHeader: {
    flex: 1,
    padding: 8,
    backgroundColor: '#f3f4f6',
    fontWeight: 700,
    fontSize: 10,
  },
  tableCell: { flex: 1, padding: 8, fontSize: 10 },
  footer: { marginTop: 32, fontSize: 9, color: '#9ca3af', textAlign: 'center' },
  signature: { marginTop: 40 },
});

export interface OfferLetterData {
  companyName: string;
  employeeName: string;
  employeeId: string;
  designation: string;
  joiningDate: Date;
  salary: number;
  founderName: string;
}

function OfferLetterDocument({ data }: { data: OfferLetterData }) {
  const issuedDate = new Date().toLocaleDateString('en-IN', { dateStyle: 'long' });
  const joiningDateStr = data.joiningDate.toLocaleDateString('en-IN', { dateStyle: 'long' });
  const annualCtc = data.salary * 12;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.companyName}>{data.companyName}</Text>
        </View>

        <Text>{issuedDate}</Text>
        <Text style={styles.title}>Offer of Employment</Text>

        <Text style={styles.paragraph}>Dear {data.employeeName},</Text>
        <Text style={styles.paragraph}>
          We are pleased to confirm your employment with {data.companyName} in the role outlined
          below. This letter sets out the key terms of your engagement with us.
        </Text>

        <View style={styles.row}>
          <Text style={styles.label}>Employee ID</Text>
          <Text style={styles.value}>{data.employeeId}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Designation</Text>
          <Text style={styles.value}>{data.designation}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Date of joining</Text>
          <Text style={styles.value}>{joiningDateStr}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Monthly compensation</Text>
          <Text style={styles.value}>
            Rs. {data.salary.toLocaleString('en-IN')} (Annual CTC: Rs.{' '}
            {annualCtc.toLocaleString('en-IN')})
          </Text>
        </View>

        <Text style={styles.paragraph}>
          Your employment is subject to the standard policies of {data.companyName} as
          communicated to you from time to time. We look forward to your contributions and to a
          successful working relationship.
        </Text>

        <View style={styles.signature}>
          <Text>Sincerely,</Text>
          <Text style={{ marginTop: 24 }}>{data.founderName}</Text>
          <Text style={{ color: '#6b7280' }}>{data.companyName}</Text>
        </View>

        <Text style={styles.footer}>
          This is a system-generated document and does not require a physical signature.
        </Text>
      </Page>
    </Document>
  );
}

export async function generateOfferLetterPdf(data: OfferLetterData): Promise<Buffer> {
  return renderToBuffer(<OfferLetterDocument data={data} />);
}

export interface InvoiceLineData {
  companyName: string;
  companyGstin: string;
  companyAddress: string;
  companyEmail: string;
  invoiceNo: string;
  createdAt: Date;
  dueDate: Date;
  clientName: string;
  clientGstin?: string | null;
  clientAddress?: string | null;
  description?: string | null;
  sacCode: string;
  natureOfSupply: string;
  placeOfSupply?: string | null;
  amount: number;
  gstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  interState: boolean;
  totalAmount: number;
  paidAmount: number;
  status: string;
}

const invoiceStyles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#111827' },
  center: { textAlign: 'center' },
  companyBlock: { textAlign: 'center', marginBottom: 10 },
  companyName: { fontSize: 15, fontWeight: 700 },
  companyLine: { fontSize: 9, color: '#374151', marginTop: 2 },
  titleBar: {
    marginTop: 10,
    marginBottom: 10,
    paddingVertical: 6,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: 700,
    borderTop: '1 solid #111827',
    borderBottom: '1 solid #111827',
  },
  metaTable: { border: '1 solid #111827' },
  metaRow: { flexDirection: 'row', borderBottom: '1 solid #111827' },
  metaRowLast: { flexDirection: 'row' },
  metaLabel: {
    width: 130,
    padding: 5,
    fontWeight: 700,
    borderRight: '1 solid #111827',
    backgroundColor: '#f9fafb',
  },
  metaValue: { flex: 1, padding: 5 },
  itemsTable: { marginTop: 12, border: '1 solid #111827' },
  itemsHeaderRow: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderBottom: '1 solid #111827' },
  itemsRow: { flexDirection: 'row', borderBottom: '1 solid #111827' },
  itemsRowLast: { flexDirection: 'row' },
  colSr: { width: 28, padding: 6, borderRight: '1 solid #111827', fontWeight: 700, fontSize: 9 },
  colDesc: { flex: 2, padding: 6, borderRight: '1 solid #111827', fontSize: 9 },
  colAmt: { flex: 1, padding: 6, borderRight: '1 solid #111827', fontSize: 9, textAlign: 'right' },
  colAmtLast: { flex: 1, padding: 6, fontSize: 9, textAlign: 'right' },
  headerCell: { fontWeight: 700 },
  invoiceValueRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingRight: 4,
  },
  invoiceValueLabel: { fontWeight: 700, marginRight: 6 },
  invoiceValueAmount: { fontWeight: 700 },
  wordsLine: { marginTop: 10, fontSize: 9.5 },
  declaration: { marginTop: 16, fontSize: 9, lineHeight: 1.5, color: '#374151' },
  signatureBlock: { marginTop: 40, alignItems: 'flex-end' },
  signatureFor: { fontSize: 9.5, fontWeight: 700 },
  signatureLine: { marginTop: 30, fontSize: 9.5 },
});

function InvoiceDocument({ data }: { data: InvoiceLineData }) {
  const gstColumns = data.interState
    ? [{ label: `IGST @${data.gstRate}%`, value: data.igstAmount }]
    : [
        { label: `CGST @${data.gstRate / 2}%`, value: data.cgstAmount },
        { label: `SGST @${data.gstRate / 2}%`, value: data.sgstAmount },
      ];

  return (
    <Document>
      <Page size="A4" style={invoiceStyles.page}>
        <View style={invoiceStyles.companyBlock}>
          <Text style={invoiceStyles.companyName}>{data.companyName}</Text>
          <Text style={invoiceStyles.companyLine}>GSTIN: {data.companyGstin}</Text>
          <Text style={invoiceStyles.companyLine}>Registered Office: {data.companyAddress}</Text>
          <Text style={invoiceStyles.companyLine}>Email: {data.companyEmail}</Text>
        </View>

        <Text style={invoiceStyles.titleBar}>TAX INVOICE</Text>

        <View style={invoiceStyles.metaTable}>
          <View style={invoiceStyles.metaRow}>
            <Text style={invoiceStyles.metaLabel}>Invoice No.</Text>
            <Text style={invoiceStyles.metaValue}>{data.invoiceNo}</Text>
          </View>
          <View style={invoiceStyles.metaRow}>
            <Text style={invoiceStyles.metaLabel}>Invoice Date</Text>
            <Text style={invoiceStyles.metaValue}>
              {data.createdAt.toLocaleDateString('en-GB').split('/').join('-')}
            </Text>
          </View>
          <View style={invoiceStyles.metaRow}>
            <Text style={invoiceStyles.metaLabel}>Supplier</Text>
            <Text style={invoiceStyles.metaValue}>{data.companyName}</Text>
          </View>
          <View style={invoiceStyles.metaRow}>
            <Text style={invoiceStyles.metaLabel}>Supplier GSTIN</Text>
            <Text style={invoiceStyles.metaValue}>{data.companyGstin}</Text>
          </View>
          <View style={invoiceStyles.metaRow}>
            <Text style={invoiceStyles.metaLabel}>Recipient</Text>
            <Text style={invoiceStyles.metaValue}>{data.clientName}</Text>
          </View>
          <View style={invoiceStyles.metaRow}>
            <Text style={invoiceStyles.metaLabel}>Recipient GSTIN</Text>
            <Text style={invoiceStyles.metaValue}>{data.clientGstin || '________________'}</Text>
          </View>
          <View style={invoiceStyles.metaRow}>
            <Text style={invoiceStyles.metaLabel}>Nature of Supply</Text>
            <Text style={invoiceStyles.metaValue}>{data.natureOfSupply}</Text>
          </View>
          <View style={invoiceStyles.metaRow}>
            <Text style={invoiceStyles.metaLabel}>Place of Supply</Text>
            <Text style={invoiceStyles.metaValue}>{data.placeOfSupply || '________________'}</Text>
          </View>
          <View style={invoiceStyles.metaRow}>
            <Text style={invoiceStyles.metaLabel}>Service</Text>
            <Text style={invoiceStyles.metaValue}>{data.description || 'Professional Services'}</Text>
          </View>
          <View style={invoiceStyles.metaRowLast}>
            <Text style={invoiceStyles.metaLabel}>SAC Code</Text>
            <Text style={invoiceStyles.metaValue}>{data.sacCode}</Text>
          </View>
        </View>

        <View style={invoiceStyles.itemsTable}>
          <View style={invoiceStyles.itemsHeaderRow}>
            <Text style={[invoiceStyles.colSr, invoiceStyles.headerCell]}>Sr.</Text>
            <Text style={[invoiceStyles.colDesc, invoiceStyles.headerCell]}>Description</Text>
            <Text style={[invoiceStyles.colAmt, invoiceStyles.headerCell]}>Taxable Value</Text>
            {gstColumns.map((col) => (
              <Text key={col.label} style={[invoiceStyles.colAmt, invoiceStyles.headerCell]}>
                {col.label}
              </Text>
            ))}
            <Text style={[invoiceStyles.colAmtLast, invoiceStyles.headerCell]}>Total</Text>
          </View>
          <View style={invoiceStyles.itemsRowLast}>
            <Text style={invoiceStyles.colSr}>1</Text>
            <Text style={invoiceStyles.colDesc}>{data.description || 'Professional Services'}</Text>
            <Text style={invoiceStyles.colAmt}>Rs. {data.amount.toLocaleString('en-IN')}</Text>
            {gstColumns.map((col) => (
              <Text key={col.label} style={invoiceStyles.colAmt}>
                Rs. {col.value.toLocaleString('en-IN')}
              </Text>
            ))}
            <Text style={invoiceStyles.colAmtLast}>Rs. {data.totalAmount.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        <View style={invoiceStyles.invoiceValueRow}>
          <Text style={invoiceStyles.invoiceValueLabel}>Invoice Value:</Text>
          <Text style={invoiceStyles.invoiceValueAmount}>
            Rs. {data.totalAmount.toLocaleString('en-IN')}
          </Text>
        </View>

        <Text style={invoiceStyles.wordsLine}>Amount in Words: {amountInWords(data.totalAmount)}</Text>

        {data.paidAmount > 0 && (
          <Text style={invoiceStyles.wordsLine}>
            Amount Paid: Rs. {data.paidAmount.toLocaleString('en-IN')} · Balance Due: Rs.{' '}
            {(data.totalAmount - data.paidAmount).toLocaleString('en-IN')} · Status: {data.status}
          </Text>
        )}

        <Text style={invoiceStyles.declaration}>
          Declaration: We declare that this invoice shows the actual value of the services supplied
          and that all particulars are true and correct.
        </Text>

        <View style={invoiceStyles.signatureBlock}>
          <Text style={invoiceStyles.signatureFor}>For {data.companyName}</Text>
          <Text style={invoiceStyles.signatureLine}>Authorized Signatory</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateInvoicePdf(data: InvoiceLineData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument data={data} />);
}

export interface SalarySlipData {
  companyName: string;
  companyAddress: string;
  employeeName: string;
  employeeId: string;
  designation: string;
  monthLabel: string; // e.g. "July 2026"
  grossSalary: number;
  deductions: number;
}

function SalarySlipDocument({ data }: { data: SalarySlipData }) {
  const netPay = data.grossSalary - data.deductions;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.companyName}>{data.companyName}</Text>
          <Text style={{ fontSize: 9, color: '#6b7280', marginTop: 2 }}>{data.companyAddress}</Text>
        </View>

        <Text style={styles.title}>Salary Slip — {data.monthLabel}</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Employee</Text>
          <Text style={styles.value}>{data.employeeName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Employee ID</Text>
          <Text style={styles.value}>{data.employeeId}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Designation</Text>
          <Text style={styles.value}>{data.designation}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellHeader}>Component</Text>
            <Text style={styles.tableCellHeader}>Amount</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>Gross Salary</Text>
            <Text style={styles.tableCell}>Rs. {data.grossSalary.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>Deductions</Text>
            <Text style={styles.tableCell}>Rs. {data.deductions.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.tableRowLast}>
            <Text style={[styles.tableCell, { fontWeight: 700 }]}>Net Pay</Text>
            <Text style={[styles.tableCell, { fontWeight: 700 }]}>
              Rs. {netPay.toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>
          This is a system-generated salary slip and does not require a signature.
        </Text>
      </Page>
    </Document>
  );
}

export async function generateSalarySlipPdf(data: SalarySlipData): Promise<Buffer> {
  return renderToBuffer(<SalarySlipDocument data={data} />);
}
