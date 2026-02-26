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
  description: string;
  amount: string;
  chargeDate: string;
  loginUrl: string;
}

const Component: FC<Props> = ({
  name,
  imageBaseUrl,
  description,
  amount,
  chargeDate,
  loginUrl,
}) => (
  <Html>
    <Head />
    <Preview>
      Percy Main Community Sports Club - Payment Reminder: {description}
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
          This is a friendly reminder that you have an outstanding payment on
          your account:
        </Text>
        <ul>
          <li>
            <em>Description: </em>
            {description}
          </li>
          <li>
            <em>Amount: </em>
            {amount}
          </li>
          <li>
            <em>Date: </em>
            {chargeDate}
          </li>
        </ul>
        <Text style={styles.paragraph}>
          Please log in to the members area to complete your payment at your
          earliest convenience.
        </Text>
        <Section style={styles.btnContainer}>
          <Button style={styles.button} href={loginUrl}>
            Log In to Pay
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

export const PaymentReminder = email<Props>("Payment Reminder", {
  preview: {
    imageBaseUrl: "http://localhost:4321/images",
    name: "Alex",
    description: "Match fee - Senior XI vs Benwell Hill",
    amount: "\u00a35.00",
    chargeDate: "25/02/2026",
    loginUrl: "http://localhost:4321/auth/login",
  },
})(Component);

export default PaymentReminder.component;
