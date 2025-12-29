import { exec } from "child_process";

exec("incus list --format=json", (err, stdout) => {
  if (err) {
    console.error(err);
    return;
  }

  const containers = JSON.parse(stdout);
  containers.forEach(c => {
    console.log({
      name: c.name,
      status: c.status,
      type: c.type,
      ipv4: c.state?.network?.eth0?.addresses?.find(a => a.family === "inet")?.address
    });
  });
});