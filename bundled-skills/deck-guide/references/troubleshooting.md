# Troubleshooting

Go in this order and stop at the first thing that explains it.

1. **Tab stuck on pairing / "agent offline" while the machine is up.** The relay may be
   behind the code (relay deploys are manual). Only the Deck owner can fix it; see
   `docs/RUNBOOK.md` step 1.
2. **Is the relay up?** `curl -s https://deck-relay.devfellowship.com/status` should return
   `ok:true`.
3. **Is the agent running on the machine?**
   `systemctl status deck-agent` and `journalctl -u deck-agent -n 50`. Without systemd:
   `pgrep -af 'server/agent.ts'`. Restart (ask first): `sudo systemctl restart deck-agent`.
4. **Claude not logged in / "claude not ready".** Run `claude` once on the machine and log
   in, then restart the agent. The Deck can also guide the login code from the chat screen.
5. **Pairing code rejected.** Codes are single use and expire in 10 minutes; generate a
   new one. Limit is 5 codes per minute and 10 machines per account.
6. **Machine frozen or slow.** `free -h; df -h /; uptime`. The agent kills running turns
   itself when load is above 4x cores or memory under 120 MB. Disk under ~5 GB free also
   breaks things (Docker build cache is the usual cause).
7. **New browser cannot enter a machine.** It is not in the trusted-device list. Enroll it
   (see machines-and-devices).
8. **Update did not arrive.** Self-update needs a clean clone on `main` and a supervisor
   (systemd or the nohup loop); otherwise it does not update.
9. **A cron did not fire.** The machine must be on; daily times are Brasília time.
10. **Quota/limit pause.** The header shows the plan limit; turns resume after the reset
    time shown.

Health: `curl -s 127.0.0.1:7777/healthz` on the machine (local backend).
Never paste identity files, tokens or pairing codes into chat when asking for help.
