import { Html5QrcodeScanner } from "html5-qrcode";
import { useEffect } from "react";

export default function QRScanner({ onResult, onClose }) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: 250 },
      false
    );

    scanner.render(
      (decodedText) => {
        scanner.clear();
        onResult(decodedText);
      },
      () => {}
    );

    return () => scanner.clear();
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded w-[340px]">
        <div id="qr-reader" />
        <button
          onClick={onClose}
          className="mt-3 w-full bg-red-600 text-white py-2 rounded"
        >
          Tutup
        </button>
      </div>
    </div>
  );
}
