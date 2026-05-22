import React from "react";

interface PrintReportButtonProps {
  onClick: () => void;
}

export function PrintReportButton({ onClick }: PrintReportButtonProps) {
  return (
    <button type="button" onClick={onClick} className="ui-btn-secondary px-4 py-2 text-sm">
      Печать
    </button>
  );
}

export default PrintReportButton;
