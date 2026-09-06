import {
  CANNED_WOM_BILL,
  CANNED_WOM_SERVICE,
  CANNED_WOM_USAGE,
  type WomBill,
  type WomDirectory,
  type WomServiceStatus,
  type WomUsage,
} from "../../domain/wom-tools.js";

export const cannedWomDirectory: WomDirectory = {
  getCustomerUsage(): WomUsage {
    return { ...CANNED_WOM_USAGE };
  },
  getBillStatus(): WomBill {
    return { ...CANNED_WOM_BILL };
  },
  checkServiceStatus(): WomServiceStatus {
    return { ...CANNED_WOM_SERVICE };
  },
};

export function failingWomDirectory(message = "simulated WOM directory failure"): WomDirectory {
  const fail = (): never => {
    throw new Error(message);
  };
  return {
    getCustomerUsage: fail,
    getBillStatus: fail,
    checkServiceStatus: fail,
  };
}
