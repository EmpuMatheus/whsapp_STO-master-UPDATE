import jsPDF from "jspdf";
import QRCode from "qrcode";

export async function generateTagPDF({ tags }) {
  const tagList = tags && tags.length > 0 ? tags : [];
  if (tagList.length === 0) return;

  let doc = null;

  for (let i = 0; i < tagList.length; i++) {
    const tag = tagList[i];
    const tagQr = tag.tag_qr;
    const parts = tagQr.split("-");
    const whs_code = tag.whs_code || parts[0];
    const item_code = tag.item_code || parts[1];
    const description = tag.description || "";
    const counter_name = tag.counter_name || "";
    const verificator_name = tag.verificator_name || "";
    const location_name = tag.location_name || "";
    const detail_location = tag.detail_location || tag.location_detail || "";

    if (i === 0) {
      doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [100, 80] });
    } else {
      doc.addPage([100, 80], "landscape");
    }

    /* ================= HEADER ================= */
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`NO TAG : ${tagQr}`, 4, 6);

    doc.setFontSize(10);
    doc.text("Form Tag Stock Opname", 28, 10);

    /* ================= INFO ================= */
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);

    const today = new Date().toLocaleDateString("id-ID");

    let y = 14;
    const gap = 3.8;

    doc.text(`Gudang   : ${whs_code}`, 4, y); y += gap;
    doc.text(`Tgl Cetak: ${today}`, 4, y); y += gap;
    doc.text(`Tgl STO  : ${today}`, 4, y); y += gap;
    doc.text(`Item Code: ${item_code}`, 4, y); y += gap;

    /* ================= DESCRIPTION (render line by line) ================= */
    const descLines = doc.splitTextToSize(`Desc: ${description || "-"}`, 50);
    const descLineH = 10 * 0.3528 * 1.2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    for (let j = 0; j < descLines.length; j++) {
      doc.text(descLines[j], 4, y);
      y += descLineH;
    }

    /* ================= DETAIL LOCATION ================= */
    if (detail_location) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(`Detail Location: ${detail_location}`, 4, y);
      y += 8 * 0.3528 * 1.2 + 1;
    } else {
      y += 1;
    }

    /* ================= QR ================= */
    const qr = await QRCode.toDataURL(tagQr, { margin: 0 });
    doc.addImage(qr, "PNG", 72, 12, 24, 24);

    /* ================= TABLE (dynamic position) ================= */
    const tableY = y + 2;
    const col1 = 4;
    const col2 = 35;
    const col3 = 66;
    const right = 96;
    const rowHeight = 14;
    const half = rowHeight / 2;

    doc.setLineWidth(0.3);
    doc.line(col1, tableY, right, tableY);
    doc.line(col1, tableY + rowHeight, right, tableY + rowHeight);
    doc.line(col1, tableY + half, right, tableY + half);
    doc.line(col2, tableY, col2, tableY + rowHeight);
    doc.line(col3, tableY, col3, tableY + rowHeight);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Counter", col1 + 10, tableY + 4, { align: "center" });
    doc.text("Verificator", col2 + 13, tableY + 4, { align: "center" });
    doc.text("Located", col3 + 10, tableY + 4, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.text(counter_name || "", col1 + 12, tableY + 12, { align: "center" });
    doc.text(verificator_name || "", col2 + 14, tableY + 12, { align: "center" });
    doc.text(location_name || "", col3 + 12, tableY + 12, { align: "center" });

    /* ================= FOOTER ================= */
    const fy = tableY + rowHeight + 2;
    const footerHeight = 18;
    const halfFooter = footerHeight / 2;

    doc.line(col1, fy, right, fy);
    doc.line(col1, fy + footerHeight, right, fy + footerHeight);
    doc.line(col1, fy + halfFooter, right, fy + halfFooter);
    doc.line(col2, fy, col2, fy + footerHeight);
    doc.line(col3, fy, col3, fy + footerHeight);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("1st Count", col1 + 10, fy + 4, { align: "center" });
    doc.text("Recount", col2 + 10, fy + 4, { align: "center" });
    doc.text("Batch", col3 + 10, fy + 4, { align: "center" });
  }

  if (doc) {
    const filename = tagList.length === 1
      ? `TAG-${tagList[0].tag_qr}.pdf`
      : `TAGS-${tagList.length}-tags.pdf`;
    doc.save(filename);
  }
}
