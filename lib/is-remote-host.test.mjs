import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const { isRemoteHost } = await createJiti(import.meta.url).import("./is-remote-host.ts");

test("localhost / loopback are local (not remote)", () => {
  assert.equal(isRemoteHost("localhost"), false);
  assert.equal(isRemoteHost("127.0.0.1"), false);
  assert.equal(isRemoteHost("::1"), false);
  assert.equal(isRemoteHost("127.8.2.3"), false);
});

test("private LAN ranges are local (not remote)", () => {
  assert.equal(isRemoteHost("10.0.0.1"), false);
  assert.equal(isRemoteHost("10.99.255.1"), false);
  assert.equal(isRemoteHost("172.16.0.1"), false);
  assert.equal(isRemoteHost("172.31.255.255"), false);
  assert.equal(isRemoteHost("192.168.1.100"), false);
  assert.equal(isRemoteHost("192.168.255.254"), false);
});

test("public hostnames and public IPs are remote", () => {
  assert.equal(isRemoteHost("pi.sg.roynz.cn"), true);
  assert.equal(isRemoteHost("example.com"), true);
  assert.equal(isRemoteHost("8.8.8.8"), true);
  assert.equal(isRemoteHost("1.2.3.4"), true);
  assert.equal(isRemoteHost("2001:db8::1"), true);
  assert.equal(isRemoteHost("sub.example.org"), true);
});

test("hostname with port or scheme is normalized first", () => {
  // The helper should tolerate common Host-header forms.
  assert.equal(isRemoteHost("pi.sg.roynz.cn:443"), true);
  assert.equal(isRemoteHost("127.0.0.1:30141"), false);
  assert.equal(isRemoteHost("[::1]:30141"), false);
});