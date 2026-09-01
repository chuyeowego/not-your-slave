import { eveChannel } from "eve/channels/eve";

import { policy } from "../lib/auth";

export default eveChannel({ auth: policy });
