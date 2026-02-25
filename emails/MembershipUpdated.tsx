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
import { formatDate } from "date-fns";
import type { FC } from "react";
import { match } from "ts-pattern";
import { email } from "./email";
import * as styles from "./styles";

interface Props {
  imageBaseUrl: string;
  name: string;

  type: string | undefined;

  paid_until: string;

  isNew: boolean;
}

const Component: FC<Props> = ({
  type,
  name,
  imageBaseUrl,
  paid_until,
  isNew,
}) => (
  <Html>
    <Head />
    <Preview>Percy Main Community Sports Club - Verify Your Email</Preview>
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
          Thanks for {isNew ? "starting" : "extending"} your membership to Percy
          Main Cricket and Sports Club.
        </Text>
        <ul>
          <li>
            <em>Type: </em>
            {match(type)
              .with("senior_player", () => "Senior Player")
              .with("social", () => "Social")
              .with("junior", () => "Junior")
              .otherwise(() => "Unknown")}
          </li>
          <li>
            <em>Valid Until: </em>
            {formatDate(new Date(paid_until), "dd/MM/yyyy")}
          </li>
        </ul>
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

export const MembershipCreated = email<Props>("Welcome to The Main", {
  preview: {
    imageBaseUrl: "http://localhost:4321/images",
    name: "Alex",
    type: "senior_player",
    paid_until: "2026-03-01T15:59:39.000Z",
    isNew: true,
  },
})(Component);

export default MembershipCreated.component;
