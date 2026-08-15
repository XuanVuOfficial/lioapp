import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Lead, Department, UserProfile } from '../types';

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

/**
 * Parses a date string and returns a formatted date time HH:mm DD/MM/YYYY
 */
const formatDateTime = (dateStr?: string): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${mins} ${day}/${month}/${year}`;
  } catch {
    return '';
  }
};

interface ExportParams {
  leads: Lead[];
  departments: Department[];
  staff?: UserProfile[];
  selectedDeptId?: string;
  projectName?: string;
  staffName?: string;
}

export const exportLeadsToExcel = async ({
  leads,
  departments,
  staff = [],
  selectedDeptId,
  projectName,
  staffName
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

  // 2. Determine title based on selected department, project, staff or default
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
  if (staffName) {
    title += ` - NHÂN VIÊN: ${staffName.toUpperCase()}`;
  }

  // Define column dimensions and settings
  worksheet.columns = [
    { key: 'stt', width: 6 },
    { key: 'customerName', width: 26 },
    { key: 'phone', width: 16 },
    { key: 'createdAt', width: 16 },
    { key: 'assignedBy', width: 22 },
    { key: 'assignedTo', width: 22 },
    { key: 'assignedAt', width: 20 },
    { key: 'status_contacted', width: 14 },
    { key: 'status_uncontacted', width: 16 },
    { key: 'status_met', width: 12 },
    { key: 'status_viewed', width: 20 },
    { key: 'status_deposited', width: 12 },
    { key: 'status_booked', width: 14 },
    { key: 'status_nodemand', width: 18 },
    { key: 'feedback', width: 50 }
  ];

  // 3. Merging header zones
  // Left Section (Logo Area): Merge A1:D2
  worksheet.mergeCells('A1:D2');
  const logoCell = worksheet.getCell('A1');
  logoCell.value = 'THIÊN LONG\nTỔNG SÀN GIAO DỊCH BĐS';
  logoCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  logoCell.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'B48A3E' } }; // Gold/Brown theme
  logoCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'E2EFDA' }
  };

  // Right Section Row 1 (Title): Merge E1:O1
  worksheet.mergeCells('E1:O1');
  const titleCell = worksheet.getCell('E1');
  titleCell.value = title;
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.font = { name: 'Times New Roman', size: 14, bold: true, color: { argb: '000000' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FCE4D6' } // Peach/apricot background
  };

  // Right Section Row 2 (Date range): Merge E2:O2
  worksheet.mergeCells('E2:O2');
  const dateCell = worksheet.getCell('E2');
  dateCell.value = `(Từ ngày ${minDateStr} đến ngày ${maxDateStr})`;
  dateCell.alignment = { vertical: 'middle', horizontal: 'center' };
  dateCell.font = { name: 'Times New Roman', size: 11, italic: true, color: { argb: '000000' } };
  dateCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'D9E1F2' } // Light greyish-blue background
  };

  // Right Section Row 3 (KẾT QUẢ category title over H3:N3)
  worksheet.mergeCells('H3:N3');
  const resultHeaderCell = worksheet.getCell('H3');
  resultHeaderCell.value = 'KẾT QUẢ';
  resultHeaderCell.alignment = { vertical: 'middle', horizontal: 'center' };
  resultHeaderCell.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: '000000' } };
  resultHeaderCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'D9E1F2' }
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

  worksheet.mergeCells('E3:E4');
  const assignerHeader = worksheet.getCell('E3');
  assignerHeader.value = 'NGƯỜI CHIA DATA';

  worksheet.mergeCells('F3:F4');
  const assigneeHeader = worksheet.getCell('F3');
  assigneeHeader.value = 'NGƯỜI NHẬN DATA';

  worksheet.mergeCells('G3:G4');
  const assignTimeHeader = worksheet.getCell('G3');
  assignTimeHeader.value = 'THỜI GIAN NHẬN';

  worksheet.mergeCells('O3:O4');
  const feedbackHeader = worksheet.getCell('O3');
  feedbackHeader.value = 'PHẢN HỒI CHUNG';

  // 5. Setup Row 4 values for category subheaders
  const row4 = worksheet.getRow(4);
  row4.getCell('H').value = 'ĐÃ LIÊN HỆ';
  row4.getCell('I').value = 'CHƯA LIÊN HỆ';
  row4.getCell('J').value = 'ĐÃ GẶP';
  row4.getCell('K').value = 'ĐÃ XEM NHÀ MẪU';
  row4.getCell('L').value = 'ĐÃ CỌC';
  row4.getCell('M').value = 'ĐÃ BOOKING';
  row4.getCell('N').value = 'KHÔNG NHU CẦU';

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
    'E3', 'E4', 'F3', 'F4', 'G3', 'G4',
    'H3', 'H4', 'I4', 'J4', 'K4', 'L4', 'M4', 'N4',
    'O3', 'O4'
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
    'A1', 'B1', 'C1', 'D1', 'A2', 'B2', 'C2', 'D2',
    'E1', 'F1', 'G1', 'H1', 'I1', 'J1', 'K1', 'L1', 'M1', 'N1', 'O1',
    'E2', 'F2', 'G2', 'H2', 'I2', 'J2', 'K2', 'L2', 'M2', 'N2', 'O2'
  ];
  titleAndLogoCells.forEach(ref => {
    const cell = worksheet.getCell(ref);
    cell.border = headerBorder as any;
  });

  const getStaffDisplayName = (email?: string): string => {
    if (!email) return '';
    const cleanEmail = email.trim().toLowerCase();
    const found = staff.find(s => s.email && s.email.trim().toLowerCase() === cleanEmail);
    return found ? found.displayName : email;
  };

  /**
   * Tổng hợp đầy đủ: Trạng thái chi tiết + Ghi chú ban đầu + Lịch sử trao đổi/phản hồi
   */
  const formatLeadFeedback = (lead: Lead): string => {
    const sections: string[] = [];

    // 1. Chuỗi phân cấp trạng thái hiện tại (nếu có chi tiết)
    const statusParts: string[] = [];
    if (lead.status && lead.status !== 'Chưa liên hệ') statusParts.push(lead.status);
    if (lead.subStatus) statusParts.push(lead.subStatus);
    if (lead.appointmentStatus) statusParts.push(lead.appointmentStatus);
    if (lead.resultStatus) statusParts.push(lead.resultStatus);

    if (statusParts.length > 0) {
      sections.push(`[Trạng thái]: ${statusParts.join(' > ')}`);
    }

    // 2. Ghi chú ban đầu
    if (lead.notes && String(lead.notes).trim()) {
      sections.push(`[Ghi chú ban đầu]: ${String(lead.notes).trim()}`);
    } else if (lead.details && String(lead.details).trim()) {
      sections.push(`[Ghi chú ban đầu]: ${String(lead.details).trim()}`);
    }

    // 3. Lịch sử trao đổi / phản hồi của nhân viên (từ lead.history)
    let rawHistory: any = lead.history;
    if (typeof rawHistory === 'string') {
      try {
        rawHistory = JSON.parse(rawHistory);
      } catch {
        rawHistory = [];
      }
    }

    if (Array.isArray(rawHistory) && rawHistory.length > 0) {
      const feedbackEntries: string[] = [];

      rawHistory.forEach(entry => {
        if (typeof entry !== 'string') return;
        const trimEntry = entry.trim();
        if (!trimEntry) return;

        // 3.1 Ghi chú trao đổi [NOTE]
        if (trimEntry.startsWith('[NOTE]')) {
          const clean = trimEntry.replace(/^\[NOTE\]/, '').trim();
          const m = clean.match(/^\[(.*?)\]\s*(.*?):\s*(.*)$/);
          if (m) {
            const time = m[1].trim();
            const actor = m[2].trim();
            const note = m[3].trim();
            feedbackEntries.push(`• [${time}] ${actor}: ${note}`);
          } else {
            feedbackEntries.push(`• ${clean}`);
          }
        }
        // 3.2 Cập nhật trạng thái [LOG] có note hoặc ghi nhận hành động
        else if (trimEntry.startsWith('[LOG]')) {
          const clean = trimEntry.replace(/^\[LOG\]/, '').trim();
          const noteMatch = clean.match(/\(note:\s*([^)]+)\)/i);
          const m = clean.match(/^\[(.*?)\]\s*(.*?):\s*(.*)$/);
          const time = m ? m[1].trim() : '';
          const actor = m ? m[2].trim() : '';

          if (noteMatch) {
            const noteContent = noteMatch[1].trim();
            const statusMatch = clean.match(/"([^"]+)"/);
            const st = statusMatch ? `[${statusMatch[1]}] ` : '';
            feedbackEntries.push(`• [${time}] ${actor}: ${st}Ghi chú: ${noteContent}`);
          } else if (clean.toLowerCase().includes('cập nhật trạng thái')) {
            const statusMatch = clean.match(/"([^"]+)"/);
            if (statusMatch) {
              feedbackEntries.push(`• [${time}] ${actor}: Cập nhật "${statusMatch[1]}"`);
            } else {
              feedbackEntries.push(`• [${time}] ${actor}: ${m ? m[3].trim() : clean}`);
            }
          } else if (clean.toLowerCase().includes('thu hồi')) {
            feedbackEntries.push(`• [${time}] ${actor}: Đã thu hồi data`);
          }
        }
        // 3.3 Chuỗi thông thường khác
        else if (!trimEntry.toLowerCase().includes('người phụ trách:')) {
          feedbackEntries.push(`• ${trimEntry}`);
        }
      });

      if (feedbackEntries.length > 0) {
        sections.push(`[Lịch sử trao đổi]:\n${feedbackEntries.join('\n')}`);
      }
    }

    return sections.join('\n\n').trim();
  };

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

    const assignerName = getStaffDisplayName(lead.assignedByEmail || lead.creatorEmail);
    const assigneeName = lead.assignedToEmail ? getStaffDisplayName(lead.assignedToEmail) : 'Chưa phân chia';
    const assignedTimeStr = lead.assignedAt ? formatDateTime(lead.assignedAt) : (lead.assignedToEmail ? formatDateTime(lead.createdAt) : '');

    // Populate columns
    row.getCell('A').value = index + 1; // STT
    row.getCell('B').value = lead.customerName; // Name
    row.getCell('C').value = lead.phone; // Phone
    row.getCell('D').value = formatDate(lead.createdAt); // Date
    row.getCell('E').value = assignerName; // Người chia
    row.getCell('F').value = assigneeName; // Người nhận
    row.getCell('G').value = assignedTimeStr; // Thời gian nhận

    // Status columns with "X" mark if true
    row.getCell('H').value = isContacted ? 'X' : '';
    row.getCell('I').value = isUncontacted ? 'X' : '';
    row.getCell('J').value = isMet ? 'X' : '';
    row.getCell('K').value = isViewed ? 'X' : '';
    row.getCell('L').value = isDeposited ? 'X' : '';
    row.getCell('M').value = isBooked ? 'X' : '';
    row.getCell('N').value = isNoDemand ? 'X' : '';

    // Feedback notes: comprehensive feedback (status chain, initial notes, full history exchange)
    const feedbackVal = formatLeadFeedback(lead);
    row.getCell('O').value = feedbackVal;

    // Dynamic row height for multiline feedback
    const feedbackLines = feedbackVal ? feedbackVal.split('\n').length : 1;
    row.height = Math.max(22, Math.min(220, feedbackLines * 16 + 6));

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
      } else if (colNumber === 3 || colNumber === 4 || colNumber === 7) {
        // Phone, Date, Assigned Time centered
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber === 5 || colNumber === 6) {
        // Assigner, Assignee left aligned
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else if (colNumber >= 8 && colNumber <= 14) {
        // Status columns centered and styled green bold if "X"
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (cell.value === 'X') {
          cell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: '107C41' } }; // Excel green
        }
      } else if (colNumber === 15) {
        // Feedback left aligned, wrap text enabled
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      }
    });

    currentRowNum++;
  });

  // Set default height for header rows
  worksheet.getRow(1).height = 25;
  worksheet.getRow(2).height = 22;
  worksheet.getRow(3).height = 22;
  worksheet.getRow(4).height = 22;

  // 7. Write to Buffer and trigger save
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  
  // Create filename with current date
  const today = new Date();
  const dateFormatted = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const staffSuffix = staffName ? `_${staffName.replace(/\s+/g, '_')}` : '';
  const filename = `Bao_Cao_Khach_Hang${staffSuffix}_${dateFormatted}.xlsx`;
  
  saveAs(blob, filename);
};
