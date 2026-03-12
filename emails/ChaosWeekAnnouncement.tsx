import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Button,
} from "@react-email/components";
import type { FC } from "react";
import { email } from "./email";
import * as styles from "./styles";

interface Props {
  imageBaseUrl: string;
  name: string;
  chaosName: string;
  chaosDescription: string;
  gameweek: number;
  fantasyUrl: string;
}

const Component: FC<Props> = ({
  name,
  imageBaseUrl,
  chaosName,
  chaosDescription,
  gameweek,
  fantasyUrl,
}) => (
  <Html>
    <Head />
    <Preview>
      Chaos Week alert: {chaosName} is active for Gameweek {String(gameweek)}!
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
        <Text style={{ ...styles.paragraph, fontSize: "20px", fontWeight: "bold" }}>
          CHAOS WEEK: {chaosName}
        </Text>
        <Text style={styles.paragraph}>
          Gameweek {gameweek} is a chaos week! Here&apos;s what&apos;s happening:
        </Text>
        <Text
          style={{
            ...styles.paragraph,
            backgroundColor: "#FEF3C7",
            padding: "12px 16px",
            borderRadius: "6px",
            borderLeft: "4px solid #F59E0B",
          }}
        >
          {chaosDescription}
        </Text>
        <Text style={styles.paragraph}>
          Check your team and make sure you&apos;re prepared for the chaos!
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

export const ChaosWeekAnnouncement = email<Props>(
  "Fantasy Cricket: Chaos Week Alert!",
  {
    preview: {
      imageBaseUrl: "http://localhost:4321/images",
      name: "Alex",
      chaosName: "Sandwich Inflation Crisis",
      chaosDescription:
        "All 1-sandwich valued players score DOUBLE points this week!",
      gameweek: 5,
      fantasyUrl: "http://localhost:4321/members/fantasy",
    },
  },
)(Component);

export default ChaosWeekAnnouncement.component;
