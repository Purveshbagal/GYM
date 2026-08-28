/**
 * Shared helper for the Phase 3 diagnostic scripts: create/delete a
 * throwaway test user on the device so fingerprint/face capture endpoints
 * can be probed without touching any real member's employeeNo. Not part
 * of the packaged agent - diagnostic tooling only.
 */
const { isapiRequest } = require("../shared/isapi/isapiClient");

function toIsoLocal(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function createTestUser(device, employeeNo, name) {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);
  const res = await isapiRequest(device, "/ISAPI/AccessControl/UserInfo/Record?format=json", "POST", {
    UserInfo: {
      employeeNo,
      name,
      userType: "normal",
      Valid: { enable: true, beginTime: toIsoLocal(now), endTime: toIsoLocal(tomorrow), timeType: "local" },
      doorRight: "1",
      RightPlan: [{ doorNo: 1, planTemplateNo: "1" }],
    },
  });
  return res;
}

async function deleteTestUser(device, employeeNo) {
  return isapiRequest(device, "/ISAPI/AccessControl/UserInfo/Delete?format=json", "PUT", {
    UserInfoDelCond: { EmployeeNoList: [{ employeeNo }] },
  });
}

module.exports = { createTestUser, deleteTestUser };
