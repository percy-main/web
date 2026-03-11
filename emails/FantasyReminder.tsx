import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { FC } from "react";
import { email } from "./email";
import * as styles from "./styles";

interface Props {
  imageBaseUrl: string;
  name: string;
  gameweek: number;
  fantasyUrl: string;
}

const Component: FC<Props> = ({
  name,
  imageBaseUrl,
  gameweek,
  fantasyUrl,
}) => (
  <Html>
    <Head />
    <Preview>
      Fantasy Cricket reminder: set your team before Friday&apos;s deadline
    </Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Img
          src={`${imageBaseUrl}/club_logo.png`}
          width="100"
          height="100"
          alt="Percy Main Club Logo"
          style={styles.logo}
        />
        <Text style={styles.paragraph}>Hi {name},</Text>
        <Text style={styles.paragraph}>
          This is a friendly reminder that teams lock for Gameweek {gameweek} at{" "}
          <strong>Friday 23:59 UK time</strong>.
        </Text>
        <Text style={styles.paragraph}>
          You haven&apos;t made any transfers this week. Now is a good time to
          review your team, consider transfers, or update your captain before
          the deadline.
        </Text>
        <Section style={styles.btnContainer}>
          <Button style={styles.button} href={fantasyUrl}>
            Review My Team
          </Button>
        </Section>
        <Text style={styles.paragraph}>
          Best,
          <br />
          Percy Main Fantasy Cricket
        </Text>
        <Hr style={styles.hr} />
        <Text style={styles.footer}>
          Percy Main Cricket Club, St. Johns Terrace, North Shields, NE29 6HS
        </Text>
      </Container>
    </Body>
  </Html>
);

export const FantasyReminder = email<Props>("Fantasy Cricket Reminder", {
  preview: {
    imageBaseUrl: "http://localhost:4321/images",
    name: "Alex",
    gameweek: 5,
    fantasyUrl: "http://localhost:4321/members/fantasy",
  },
})(Component);

export default FantasyReminder.component;
