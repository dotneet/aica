export async function sendToSlack(file: string, bugs: any[]): Promise<void> {
  if (!Bun.env.SLACK_BOT_TOKEN || !Bun.env.SLACK_CHANNEL_ID) {
    console.error("SLACK_BOT_TOKEN or SLACK_CHANNEL_ID is not set.");
    return;
  }
  const channelId = Bun.env.SLACK_CHANNEL_ID;
  const slackBotToken = Bun.env.SLACK_BOT_TOKEN;
  const bugsString = bugs
    .map((bug) => `Line ${bug.line}: ${bug.description}`)
    .join("\n");
  const message = `Critical issues found in file ${file}:\n\n${bugsString}`;
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${slackBotToken}`,
    },
    body: JSON.stringify({
      channel: channelId,
      text: message,
    }),
  });
  const data = await response.json();
  console.log(data);
}
