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
  url: string;
  name: string;
}

const Component: FC<Props> = ({ url, name, imageBaseUrl }) => (
  <Html>
    <Head />
    <Preview>Percy Main Cricket and Sports Club - Verify Your Email</Preview>
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
          Thanks for signing up to Percy Main Cricket and Sports Club.
        </Text>
        <Section style={styles.btnContainer}>
          <Button style={styles.button} href={url}>
            Verify Your Email
          </Button>
        </Section>
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

export const VerifyEmail = email<Props>("Verify your email address", {
  preview: {
    url: "http://localhost:4321/auth/email-confirmed",
    imageBaseUrl: "http://localhost:4321/images",
    name: "Alex",
  },
})(Component);

export default VerifyEmail.component;
