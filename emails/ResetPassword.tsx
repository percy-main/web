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
    <Preview>Percy Main Community Sports Club - Reset Your Password</Preview>
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
          You requested to change your password to login to Percy Main Cricket
          and Sports Club.
        </Text>
        <Section style={styles.btnContainer}>
          <Button style={styles.button} href={url}>
            Reset My Password
          </Button>
        </Section>
        <Hr style={styles.hr} />
        <Text style={styles.footer}>
          Percy Main Cricket Club, St. Johns Terrace, North Shields, NE29 6HS
        </Text>
      </Container>
    </Body>
  </Html>
);

export const ResetPassword = email<Props>("Reset Your Password", {
  preview: {
    url: "http://localhost:4321/auth/reset-password",
    imageBaseUrl: "http://localhost:4321/images",
    name: "Alex",
  },
})(Component);

export default ResetPassword.component;
