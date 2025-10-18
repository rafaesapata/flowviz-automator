export const QPROF_CONFIG = {
  baseUrl: process.env.QPROF_BASE_URL || "https://qprof.flowinvest.capital",
  credentials: {
    username: process.env.QPROF_USERNAME || "pedro.zago",
    password: process.env.QPROF_PASSWORD || "Qprof*ea2c253e"
  },
  get billingUrl() {
    return `${this.baseUrl}/Billing/FCO001.aspx`;
  }
};

