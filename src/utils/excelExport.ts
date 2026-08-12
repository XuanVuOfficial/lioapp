import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Lead, Department } from '../types';

/**
 * Parses a date string and returns a formatted date DD/MM/YYYY
 */
const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '';
  }
};

interface ExportParams {
  leads: Lead[];
  departments: Department[];
  selectedDeptId?: string;
  projectName?: string;
}

export const exportLeadsToExcel = async ({
  leads,
  departments,
  selectedDeptId,
  projectName
}: ExportParams) => {
  // Create workbook and worksheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Báo cáo');

  // Set page setup for rendering options
  worksheet.views = [{ showGridLines: true }];

  // 1. Calculate dynamic date range from exported leads
  let minDateStr = '......';
  let maxDateStr = '......';
  if (leads.length > 0) {
    const dates = leads
      .map(l => l.createdAt ? new Date(l.createdAt) : null)
      .filter((d): d is Date => d !== null && !isNaN(d.getTime()));
    if (dates.length > 0) {
      const minDateObj = new Date(Math.min(...dates.map(d => d.getTime())));
      const maxDateObj = new Date(Math.max(...dates.map(d => d.getTime())));
      minDateStr = formatDate(minDateObj.toISOString());
      maxDateStr = formatDate(maxDateObj.toISOString());
    }
  }

  // 2. Determine title based on selected department or default
  let title = 'DANH SÁCH DATA TỔNG SÀN THIÊN LONG';
  if (selectedDeptId) {
    const dept = departments.find(d => d.id === selectedDeptId);
    if (dept) {
      title = `DANH SÁCH DATA ${dept.name.toUpperCase()}`;
    }
  }
  if (projectName) {
    title += ` - DỰ ÁN ${projectName.toUpperCase()}`;
  }

  // Define column dimensions and settings
  worksheet.columns = [
    { key: 'stt', width: 6 },
    { key: 'customerName', width: 28 },
    { key: 'phone', width: 16 },
    { key: 'createdAt', width: 16 },
    { key: 'status_contacted', width: 14 },
    { key: 'status_uncontacted', width: 16 },
    { key: 'status_met', width: 12 },
    { key: 'status_viewed', width: 20 },
    { key: 'status_deposited', width: 12 },
    { key: 'status_booked', width: 14 },
    { key: 'status_nodemand', width: 18 },
    { key: 'feedback', width: 40 }
  ];

  // 3. Merging header zones as per screenshot
  // Left Section (Logo Area): Merge A1:C2
  worksheet.mergeCells('A1:C2');
  const logoCell = worksheet.getCell('A1');
  logoCell.value = 'THIÊN LONG\nTỔNG SÀN GIAO DỊCH BĐS';
  logoCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  logoCell.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'B48A3E' } }; // Gold/Brown theme
  logoCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'E2EFDA' } // Light soft pastel green/blue as requested
  };

  // Right Section Row 1 (Title): Merge D1:L1
  worksheet.mergeCells('D1:L1');
  const titleCell = worksheet.getCell('D1');
  titleCell.value = title;
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.font = { name: 'Times New Roman', size: 15, bold: true, color: { argb: '000000' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FCE4D6' } // Peach/apricot background
  };

  // Right Section Row 2 (Date range): Merge D2:L2
  worksheet.mergeCells('D2:L2');
  const dateCell = worksheet.getCell('D2');
  dateCell.value = `(Từ ngày ${minDateStr} đến ngày ${maxDateStr})`;
  dateCell.alignment = { vertical: 'middle', horizontal: 'center' };
  dateCell.font = { name: 'Times New Roman', size: 11, italic: true, color: { argb: '000000' } };
  dateCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'D9E1F2' } // Light greyish-blue background
  };

  // Right Section Row 3 (KẾT QUẢ category title over E3:K3)
  worksheet.mergeCells('E3:K3');
  const resultHeaderCell = worksheet.getCell('E3');
  resultHeaderCell.value = 'KẾT QUẢ';
  resultHeaderCell.alignment = { vertical: 'middle', horizontal: 'center' };
  resultHeaderCell.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: '000000' } };
  resultHeaderCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'D9E1F2' } // Light greyish-blue background
  };

  // 4. Merge non-result headers vertically (Row 3 to Row 4)
  worksheet.mergeCells('A3:A4');
  const sttHeader = worksheet.getCell('A3');
  sttHeader.value = 'STT';

  worksheet.mergeCells('B3:B4');
  const nameHeader = worksheet.getCell('B3');
  nameHeader.value = 'HỌ TÊN KHÁCH HÀNG';

  worksheet.mergeCells('C3:C4');
  const phoneHeader = worksheet.getCell('C3');
  phoneHeader.value = 'SỐ ĐIỆN THOẠI';

  worksheet.mergeCells('D3:D4');
  const dateHeader = worksheet.getCell('D3');
  dateHeader.value = 'NGÀY PHÁT HÀNH';

  worksheet.mergeCells('L3:L4');
  const feedbackHeader = worksheet.getCell('L3');
  feedbackHeader.value = 'PHẢN HỒI CHUNG';

  // 5. Setup Row 4 values for category subheaders
  const row4 = worksheet.getRow(4);
  row4.getCell('E').value = 'ĐÃ LIÊN HỆ';
  row4.getCell('F').value = 'CHƯA LIÊN HỆ';
  row4.getCell('G').value = 'ĐÃ GẶP';
  row4.getCell('H').value = 'ĐÃ XEM NHÀ MẪU';
  row4.getCell('I').value = 'ĐÃ CỌC';
  row4.getCell('J').value = 'ĐÃ BOOKING';
  row4.getCell('K').value = 'KHÔNG NHU CẦU';

  // Format all header cells in Row 3 and Row 4
  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'D9E1F2' }
  };
  const headerFont = {
    name: 'Times New Roman',
    size: 10,
    bold: true,
    color: { argb: '000000' }
  };
  const headerBorder = {
    top: { style: 'thin', color: { argb: '000000' } },
    left: { style: 'thin', color: { argb: '000000' } },
    bottom: { style: 'thin', color: { argb: '000000' } },
    right: { style: 'thin', color: { argb: '000000' } }
  };

  const headerCellsToFormat = [
    'A3', 'A4', 'B3', 'B4', 'C3', 'C4', 'D3', 'D4',
    'E3', 'E4', 'F4', 'G4', 'H4', 'I4', 'J4', 'K4',
    'L3', 'L4'
  ];

  headerCellsToFormat.forEach(ref => {
    const cell = worksheet.getCell(ref);
    if (!cell.fill || cell.fill.type !== 'pattern') {
      cell.fill = headerFill;
    }
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = headerBorder as any;
  });

  // Apply borders specifically to merged logo & title blocks as well
  const titleAndLogoCells = [
    'A1', 'B1', 'C1', 'A2', 'B2', 'C2',
    'D1', 'E1', 'F1', 'G1', 'H1', 'I1', 'J1', 'K1', 'L1',
    'D2', 'E2', 'F2', 'G2', 'H2', 'I2', 'J2', 'K2', 'L2'
  ];
  titleAndLogoCells.forEach(ref => {
    const cell = worksheet.getCell(ref);
    cell.border = headerBorder as any;
  });

  // 6. Populate Data starting from row 5
  let currentRowNum = 5;

  leads.forEach((lead, index) => {
    const row = worksheet.getRow(currentRowNum);

    // Map lead status
    const isContacted = lead.status === 'Đã liên hệ';
    const isUncontacted = lead.status === 'Chưa liên hệ' || lead.status === 'Không liên hệ được';
    const isMet = lead.appointmentStatus === 'Đã gặp khách / Chưa lên nhà mẫu' || lead.appointmentStatus === 'Đã gặp khách / Đã lên nhà mẫu';
    const isViewed = lead.appointmentStatus === 'Đã gặp khách / Đã lên nhà mẫu';
    const isDeposited = lead.resultStatus === 'Đã cọc';
    const isBooked = lead.resultStatus === 'Đã booking';
    const isNoDemand = lead.subStatus === 'Rác / Không quan tâm';

    // Populate columns
    row.getCell('A').value = index + 1; // STT
    row.getCell('B').value = lead.customerName; // Name
    row.getCell('C').value = lead.phone; // Phone
    row.getCell('D').value = formatDate(lead.createdAt); // Date

    // Status columns with "X" mark if true
    row.getCell('E').value = isContacted ? 'X' : '';
    row.getCell('F').value = isUncontacted ? 'X' : '';
    row.getCell('G').value = isMet ? 'X' : '';
    row.getCell('H').value = isViewed ? 'X' : '';
    row.getCell('I').value = isDeposited ? 'X' : '';
    row.getCell('J').value = isBooked ? 'X' : '';
    row.getCell('K').value = isNoDemand ? 'X' : '';

    // Feedback notes: combine substatus / appointment details if helpful, or fallback to main details/notes
    row.getCell('L').value = lead.notes || lead.details || '';

    // Style data row cells
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: 'Times New Roman', size: 10 };
      cell.border = headerBorder as any;

      // Align columns
      if (colNumber === 1) {
        // STT centered
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber === 2) {
        // Name left aligned
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else if (colNumber === 3 || colNumber === 4) {
        // Phone and Date centered
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber >= 5 && colNumber <= 11) {
        // Status columns centered and styled green bold if "X"
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (cell.value === 'X') {
          cell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: '107C41' } }; // Excel green
        }
      } else if (colNumber === 12) {
        // Feedback left aligned, wrap text enabled
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      }
    });

    currentRowNum++;
  });

  // Set default height for all rows to look spacious
  worksheet.getRow(1).height = 25;
  worksheet.getRow(2).height = 22;
  worksheet.getRow(3).height = 22;
  worksheet.getRow(4).height = 22;
  for (let r = 5; r < currentRowNum; r++) {
    worksheet.getRow(r).height = 20;
  }

  // 7. Write to Buffer and trigger save
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  
  // Create filename with current date
  const today = new Date();
  const dateFormatted = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const filename = `Bao_Cao_Khach_Hang_${dateFormatted}.xlsx`;
  
  saveAs(blob, filename);
};
