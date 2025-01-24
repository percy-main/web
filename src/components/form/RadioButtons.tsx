import type { ChangeEvent, FC } from "react";

type Controlled = {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
};

type Uncontrolled = {
  defaultValue?: string;
};

type Props = (Controlled | Uncontrolled) &
  Omit<
    React.DetailedHTMLProps<
      React.InputHTMLAttributes<HTMLInputElement>,
      HTMLInputElement
    >,
    "value" | "onChange" | "defaultValue"
  > & {
    id: string;
    options: Array<{
      title: string;
      value: string;
      description?: string;
    }>;
  };

export const RadioButtons: FC<Props> = ({ options, id, ...inputProps }) => (
  <div className="relative z-0 w-full mt-2 mb-5 group">
    {options.map(({ title, value, description }) => (
      <div className="flex items-center mb-4">
        <input
          {...inputProps}
          id={`${id}-${value}`}
          name={id}
          value={value}
          type="radio"
          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
        />
        <div className="ms-2 text-sm">
          <label
            htmlFor={`${id}-${value}`}
            className="font-medium text-gray-900 dark:text-gray-300"
          >
            {title}
            {description && (
              <p
                id="helper-radio-text"
                className="text-xs font-normal text-gray-500 dark:text-gray-300"
              >
                {description}
              </p>
            )}
          </label>
        </div>
      </div>
    ))}
  </div>
);
