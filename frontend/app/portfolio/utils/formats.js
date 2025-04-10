export const formatCurrencySymbol = (code) => {
    switch (code) {
      case "USD": return "$";
      case "EUR": return "€";
      case "GBP": return "£";
      case "JPY": return "¥";
      case "CAD": return "C$";
      default: return code || "?";
    }
  };
  