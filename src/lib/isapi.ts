import { isapiRequest as sharedIsapiRequest } from "./isapiClient";

export type DeviceConfig = {
  ip: string;
  port: number;
  username: string;
  password: string;
};

const isapiRequest = sharedIsapiRequest;

function toIsoLocal(date: Date) {
  // Hikvision expects "YYYY-MM-DDTHH:mm:ss" without timezone offset.
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/**
 * Creates the person record on the device with an access-valid window that
 * matches the membership period. Hikvision enforces this window on-device,
 * so once endTime passes the terminal itself rejects the member's
 * face/fingerprint with no round trip to our backend needed.
 *
 * Biometric enrollment (face/fingerprint capture) happens on the terminal
 * itself by gym staff, keyed to this same employeeNo.
 */
export async function createDeviceUser(
  device: DeviceConfig,
  params: { employeeNo: string; name: string; validFrom: Date; validTo: Date }
) {
  const payload = {
    UserInfo: {
      employeeNo: params.employeeNo,
      name: params.name,
      userType: "normal",
      Valid: {
        enable: true,
        beginTime: toIsoLocal(params.validFrom),
        endTime: toIsoLocal(params.validTo),
        timeType: "local",
      },
      doorRight: "1",
      RightPlan: [{ doorNo: 1, planTemplateNo: "1" }],
    },
  };
  return isapiRequest(device, "/ISAPI/AccessControl/UserInfo/Record?format=json", "POST", payload);
}

export async function updateDeviceUserValidity(
  device: DeviceConfig,
  params: { employeeNo: string; name: string; validFrom: Date; validTo: Date; enable: boolean }
) {
  const payload = {
    UserInfo: {
      employeeNo: params.employeeNo,
      name: params.name,
      userType: "normal",
      Valid: {
        enable: params.enable,
        beginTime: toIsoLocal(params.validFrom),
        endTime: toIsoLocal(params.validTo),
        timeType: "local",
      },
    },
  };
  return isapiRequest(device, "/ISAPI/AccessControl/UserInfo/Modify?format=json", "PUT", payload);
}

export async function disableDeviceUser(device: DeviceConfig, employeeNo: string, name: string) {
  const now = new Date();
  // Zero-length valid window in the past = device denies access immediately.
  return updateDeviceUserValidity(device, {
    employeeNo,
    name,
    validFrom: new Date(now.getTime() - 2 * 86400000),
    validTo: new Date(now.getTime() - 86400000),
    enable: true,
  });
}

export async function deleteDeviceUser(device: DeviceConfig, employeeNo: string) {
  const payload = {
    UserInfoDelCond: { EmployeeNoList: [{ employeeNo }] },
  };
  return isapiRequest(device, "/ISAPI/AccessControl/UserInfo/Delete?format=json", "PUT", payload);
}

/**
 * Registers our backend as the device's event-push target so that every
 * face/fingerprint verification (success or denied) is POSTed to
 * /api/webhooks/device-events for attendance logging.
 */
export async function registerEventListener(
  device: DeviceConfig,
  backendHost: string,
  backendPort: number
) {
  const payload = {
    HttpHostNotificationList: [
      {
        id: "1",
        url: "/api/webhooks/device-events",
        protocolType: "HTTP",
        parameterFormatType: "JSON",
        addressingFormatType: "ipaddress",
        ipAddress: backendHost,
        portNo: backendPort,
        httpAuthenticationMethod: "none",
      },
    ],
  };
  return isapiRequest(device, "/ISAPI/Event/notification/httpHosts", "PUT", payload);
}

export async function testDeviceConnection(device: DeviceConfig) {
  return isapiRequest(device, "/ISAPI/System/deviceInfo?format=json", "GET");
}
