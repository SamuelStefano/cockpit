// Neither end can tell a real first-use answer from one the relay forged, so both
// accept one only while boxes paired before passkeys migrate; new boxes pre-authorize.
export const TOFU_UNTIL = Date.UTC(2026, 10, 10);
