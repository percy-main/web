import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Text,
} from "@react-email/components";
import type { FC } from "react";
import { email } from "./email";
import * as styles from "./styles";

interface Props {
  imageBaseUrl: string;
  sponsorName: string;
  playerName: string;
  message?: string;
}

const Component: FC<Props> = ({
  imageBaseUrl,
  sponsorName,
  playerName,
  message,
}) => (
  <Html>
    <Head />
    <Preview>Thank you for sponsoring {playerName} at Percy Main!</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Img
          src={`${imageBaseUrl}/club_logo.png`}
          width="100"
          height="100"
          alt="Percy Main Club Logo"
          style={styles.logo}
        />
        <Text style={styles.paragraph}>Hi {sponsorName},</Text>
        <Text style={styles.paragraph}>
          Thank you for sponsoring {playerName} at Percy Main Community Sports
          Club! Your support makes a real difference.
        </Text>
        {message && (
          <Text style={styles.paragraph}>
            Your message: &ldquo;{message}&rdquo;
          </Text>
        )}
        <Text style={styles.paragraph}>
          Your sponsorship details will be reviewed by our team and displayed on
          the player&apos;s profile once approved. If you uploaded a logo, it
          will appear alongside your name.
        </Text>
        <Text style={styles.paragraph}>
          If you have any questions, please don&apos;t hesitate to get in touch.
        </Text>
        <Text style={styles.paragraph}>
          Best,
          <br />
          The Trustees
        </Text>
        <Hr style={styles.hr} />
        <Text style={styles.footer}>
          Percy Main Cricket Club, St. Johns Terrace, North Shields, NE29 6HS
        </Text>
      </Container>
    </Body>
  </Html>
);

export const PlayerSponsorshipConfirmation = email<Props>(
  "Thank you for your player sponsorship!",
  {
    preview: {
      imageBaseUrl: "http://localhost:4321/images",
      sponsorName: "John Smith",
      playerName: "Alex Young",
      message: "Best of luck this season!",
    },
  },
)(Component);

export default PlayerSponsorshipConfirmation.component;
